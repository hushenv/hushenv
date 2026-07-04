import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { appendAudit, auditPath, initVault, readAudit, verifyAudit } from '../src/index';

let tmpHome: string;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hushenv-audit-'));
  process.env.HUSHENV_HOME = tmpHome;
  process.env.HUSHENV_MASTER_KEY = randomBytes(32).toString('base64');
  initVault();
});

afterEach(() => {
  delete process.env.HUSHENV_HOME;
  delete process.env.HUSHENV_MASTER_KEY;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

function rewriteLine(index: number, mutate: (e: Record<string, unknown>) => void): void {
  const lines = fs.readFileSync(auditPath(), 'utf8').split('\n').filter(Boolean);
  const e = JSON.parse(lines[index]!);
  mutate(e);
  lines[index] = JSON.stringify(e);
  fs.writeFileSync(auditPath(), `${lines.join('\n')}\n`);
}

describe('audit', () => {
  it('appends a chained log and verifies', () => {
    appendAudit('init');
    appendAudit('set', { name: 'A' });
    appendAudit('get', { name: 'A', meta: { force: true } });

    const entries = readAudit();
    expect(entries.map((e) => e.event)).toEqual(['init', 'set', 'get']);
    expect(entries[0]!.prevMac).toBe('');
    expect(entries[1]!.prevMac).toBe(entries[0]!.mac);
    expect(entries[2]!.prevMac).toBe(entries[1]!.mac);
    expect(verifyAudit()).toEqual({ ok: true, entries: 3 });
  });

  it('detects an edited entry and reports its index', () => {
    appendAudit('set', { name: 'A' });
    appendAudit('set', { name: 'B' });
    rewriteLine(1, (e) => {
      e.name = 'C';
    });
    const res = verifyAudit();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.index).toBe(1);
  });

  it('detects a forged appended line', () => {
    appendAudit('set', { name: 'A' });
    fs.appendFileSync(
      auditPath(),
      `${JSON.stringify({ v: 1, ts: 'x', event: 'get', name: 'A', prevMac: 'nope', mac: 'forged' })}\n`,
    );
    expect(verifyAudit().ok).toBe(false);
  });

  it('verify fails under a different master key (the mac is key-bound)', () => {
    appendAudit('set', { name: 'A' });
    expect(verifyAudit().ok).toBe(true);
    process.env.HUSHENV_MASTER_KEY = randomBytes(32).toString('base64');
    expect(verifyAudit().ok).toBe(false);
  });

  it('readAudit honors a tail limit', () => {
    appendAudit('a');
    appendAudit('b');
    appendAudit('c');
    expect(readAudit(2).map((e) => e.event)).toEqual(['b', 'c']);
  });

  it('records only what it is given — never a value it was not passed', () => {
    appendAudit('set', { name: 'API_TOKEN' });
    const raw = fs.readFileSync(auditPath(), 'utf8');
    expect(raw).toContain('API_TOKEN');
    expect(raw).not.toContain('super-secret-value');
  });

  it('verify of an empty/absent log is ok', () => {
    expect(verifyAudit()).toEqual({ ok: true, entries: 0 });
  });
});
