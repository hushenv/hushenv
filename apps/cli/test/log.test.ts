import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendAudit, auditPath, initVault, setSecret } from '@hushenv/vault-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordAudit } from '../src/audit';
import { logCommand } from '../src/commands/log';

let tmpHome: string;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hushenv-log-'));
  process.env.HUSHENV_HOME = tmpHome;
  process.env.HUSHENV_MASTER_KEY = randomBytes(32).toString('base64');
  initVault();
});

afterEach(() => {
  delete process.env.HUSHENV_HOME;
  delete process.env.HUSHENV_MASTER_KEY;
  process.exitCode = 0;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

describe('logCommand', () => {
  it('records an event and `--verify` passes', () => {
    recordAudit('set', { name: 'A' });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    logCommand({ verify: true });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Audit log OK'));
    expect(process.exitCode).not.toBe(1);
    log.mockRestore();
  });

  it('`--verify` fails and exits 1 after a hand-edit', () => {
    appendAudit('set', { name: 'A' });
    const lines = fs.readFileSync(auditPath(), 'utf8').split('\n').filter(Boolean);
    const e = JSON.parse(lines[0]!);
    e.name = 'B';
    fs.writeFileSync(auditPath(), `${JSON.stringify(e)}\n`);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    logCommand({ verify: true });
    expect(process.exitCode).toBe(1);
    err.mockRestore();
  });

  it('lists events, and shows a message when empty', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    logCommand({});
    expect(log).toHaveBeenCalledWith('No audit log yet.');
    log.mockClear();
    recordAudit('init', { meta: { created: true } });
    logCommand({});
    expect(log).toHaveBeenCalledWith(expect.stringContaining('init'));
    log.mockRestore();
  });

  it('audit records the secret name but never its value', () => {
    setSecret('API_TOKEN', 'super-secret-value');
    recordAudit('set', { name: 'API_TOKEN' });
    const raw = fs.readFileSync(auditPath(), 'utf8');
    expect(raw).toContain('API_TOKEN');
    expect(raw).not.toContain('super-secret-value');
  });
});
