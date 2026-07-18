import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  canonicalProject,
  getStrict,
  initVault,
  listGrants,
  readAudit,
  setSecret,
} from '@hushenv/vault-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { grantCommand } from '../src/commands/grant';
import { grantsCommand } from '../src/commands/grants';
import { revokeCommand } from '../src/commands/revoke';
import { strictCommand } from '../src/commands/strict';

let tmpHome: string;
let projA: string;

const mkdir = (p: string) => fs.mkdtempSync(path.join(os.tmpdir(), p));

beforeEach(() => {
  tmpHome = mkdir('hushenv-grants-cli-');
  process.env.HUSHENV_HOME = tmpHome;
  process.env.HUSHENV_MASTER_KEY = randomBytes(32).toString('base64');
  initVault();
  projA = mkdir('hushenv-cli-projA-');
});

afterEach(() => {
  delete process.env.HUSHENV_HOME;
  delete process.env.HUSHENV_MASTER_KEY;
  for (const d of [tmpHome, projA]) fs.rmSync(d, { recursive: true, force: true });
});

describe('grants CLI', () => {
  it('grant/revoke update the vault and write audit events', () => {
    setSecret('A', 'v');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    grantCommand(['A'], { project: projA });
    expect(listGrants()[canonicalProject(projA)]).toEqual(['A']);
    expect(readAudit().some((e) => e.event === 'grant')).toBe(true);

    revokeCommand(['A'], { project: projA });
    expect(Object.hasOwn(listGrants(), canonicalProject(projA))).toBe(false);
    expect(readAudit().some((e) => e.event === 'revoke')).toBe(true);
    log.mockRestore();
  });

  it('grant warns for a name not in the vault but still applies', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    grantCommand(['GHOST'], { project: projA });
    expect(err).toHaveBeenCalledWith(expect.stringContaining('not in the vault'));
    expect(listGrants()[canonicalProject(projA)]).toEqual(['GHOST']);
    err.mockRestore();
    log.mockRestore();
  });

  it('grants lists project -> names, never values', () => {
    setSecret('API_TOKEN', 'super-secret-value');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    grantCommand(['API_TOKEN'], { project: projA });
    log.mockClear();
    grantsCommand();
    const printed = log.mock.calls.map((c) => c[0]).join('\n');
    expect(printed).toContain('API_TOKEN');
    expect(printed).not.toContain('super-secret-value');
    log.mockRestore();
  });

  it('strict shows and sets', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    strictCommand(undefined);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('off'));
    strictCommand('on');
    expect(getStrict()).toBe(true);
    log.mockRestore();
  });
});
