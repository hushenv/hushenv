import { readAudit, verifyAudit } from '@hushenv/vault-core';

export interface LogOptions {
  tail?: string;
  verify?: boolean;
  json?: boolean;
}

export function logCommand(opts: LogOptions): void {
  if (opts.verify) {
    const res = verifyAudit();
    if (res.ok) {
      console.log(
        `* Audit log OK (${res.entries} entr${res.entries === 1 ? 'y' : 'ies'}).`,
      );
    } else {
      console.error(
        `x Audit log verification FAILED at entry ${res.index}: ${res.reason}`,
      );
      process.exitCode = 1;
    }
    return;
  }

  let limit: number | undefined;
  if (opts.tail !== undefined) {
    limit = Number(opts.tail);
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error('--tail must be a non-negative integer.');
    }
  }

  const entries = readAudit(limit);
  if (entries.length === 0) {
    console.log('No audit log yet.');
    return;
  }

  if (opts.json) {
    for (const e of entries) console.log(JSON.stringify(e));
    return;
  }

  for (const e of entries) {
    const parts = [e.ts, e.event.padEnd(6)];
    if (e.name) parts.push(e.name);
    if (e.project) parts.push(`(${e.project})`);
    if (e.meta && Object.keys(e.meta).length > 0) parts.push(JSON.stringify(e.meta));
    console.log(parts.join('  '));
  }
}
