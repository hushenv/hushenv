import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import { getMasterKey } from './keychain.js';
import { auditLockPath, auditPath, hushenvHome } from './paths.js';

/**
 * Append-only audit log. Each entry is chained to the previous one with an
 * HMAC-SHA256 keyed by the master key, so entries cannot be forged or edited
 * without the key. It records names and metadata only — NEVER secret values.
 *
 * Honest boundary: the HMAC chain makes tampering with entry *contents*
 * detectable, but it cannot stop an attacker with filesystem access from
 * deleting or truncating the log. True deletion-resistance needs an off-box
 * anchor (out of scope for the offline local core).
 */
export interface AuditEntry {
  v: 1;
  ts: string;
  event: string;
  name?: string;
  project?: string;
  /** Counts/flags only — never values. */
  meta?: Record<string, unknown>;
  /** The previous entry's mac; '' for the genesis entry. */
  prevMac: string;
  mac: string;
}

export interface AuditInput {
  name?: string;
  project?: string;
  meta?: Record<string, unknown>;
}

export type VerifyResult =
  | { ok: true; entries: number }
  | { ok: false; index: number; reason: string };

/** Stable, sorted-key serialization so the MAC is reproducible on verify. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const body = Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
    .join(',');
  return `{${body}}`;
}

function computeMac(key: Buffer, entryWithoutMac: Omit<AuditEntry, 'mac'>): string {
  return createHmac('sha256', key).update(canonical(entryWithoutMac)).digest('base64');
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Lockfile mutex: serialize appends so concurrent writers can't fork the chain. */
function withLock<T>(fn: () => T): T {
  const lock = auditLockPath();
  let acquired = false;
  for (let i = 0; i < 40 && !acquired; i++) {
    try {
      const fd = fs.openSync(lock, 'wx');
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      acquired = true;
    } catch {
      // Steal a stale lock left by a crashed writer, else back off briefly.
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > 10_000) {
          fs.unlinkSync(lock);
          continue;
        }
      } catch {
        // lock vanished between openSync and statSync — retry immediately
        continue;
      }
      sleepSync(50);
    }
  }
  if (!acquired) throw new Error('Could not acquire the audit log lock.');
  try {
    return fn();
  } finally {
    try {
      fs.unlinkSync(lock);
    } catch {
      // best effort
    }
  }
}

function lastMac(): string {
  if (!fs.existsSync(auditPath())) return '';
  const lines = fs
    .readFileSync(auditPath(), 'utf8')
    .split('\n')
    .filter((l) => l.trim());
  if (lines.length === 0) return '';
  return (JSON.parse(lines[lines.length - 1] as string) as AuditEntry).mac;
}

/** Append one entry, chained to the previous. Records names/metadata, never values. */
export function appendAudit(event: string, input: AuditInput = {}): void {
  const key = getMasterKey();
  fs.mkdirSync(hushenvHome(), { recursive: true, mode: 0o700 });
  withLock(() => {
    const entryWithoutMac: Omit<AuditEntry, 'mac'> = {
      v: 1,
      ts: new Date().toISOString(),
      event,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.project !== undefined ? { project: input.project } : {}),
      ...(input.meta !== undefined ? { meta: input.meta } : {}),
      prevMac: lastMac(),
    };
    const entry: AuditEntry = {
      ...entryWithoutMac,
      mac: computeMac(key, entryWithoutMac),
    };
    fs.appendFileSync(auditPath(), `${JSON.stringify(entry)}\n`, { mode: 0o600 });
  });
}

/** Read entries (all, or the last `limit`). Empty if there is no log yet. */
export function readAudit(limit?: number): AuditEntry[] {
  if (!fs.existsSync(auditPath())) return [];
  const entries = fs
    .readFileSync(auditPath(), 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as AuditEntry);
  return limit != null ? entries.slice(-limit) : entries;
}

/** Walk the HMAC chain with the master key; report the first broken link. */
export function verifyAudit(): VerifyResult {
  const key = getMasterKey();
  if (!fs.existsSync(auditPath())) return { ok: true, entries: 0 };
  const lines = fs
    .readFileSync(auditPath(), 'utf8')
    .split('\n')
    .filter((l) => l.trim());
  let prev = '';
  for (let i = 0; i < lines.length; i++) {
    let entry: AuditEntry;
    try {
      entry = JSON.parse(lines[i] as string) as AuditEntry;
    } catch {
      return { ok: false, index: i, reason: `entry ${i} is not valid JSON` };
    }
    const { mac, ...rest } = entry;
    if (rest.prevMac !== prev) {
      return {
        ok: false,
        index: i,
        reason: `chain broken at entry ${i} (prevMac mismatch)`,
      };
    }
    if (computeMac(key, rest) !== mac) {
      return {
        ok: false,
        index: i,
        reason: `entry ${i} was altered or the key differs (mac mismatch)`,
      };
    }
    prev = mac;
  }
  return { ok: true, entries: lines.length };
}
