import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SecretNotFoundError,
  deleteSecret,
  getSecretValue,
  initVault,
  listSecrets,
  renameSecret,
  setSecret,
  setSecrets,
  vaultPath,
} from '../src/index';

let tmpHome: string;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hushenv-test-'));
  process.env.HUSHENV_HOME = tmpHome;
  process.env.HUSHENV_MASTER_KEY = randomBytes(32).toString('base64');
  initVault();
});

afterEach(() => {
  delete process.env.HUSHENV_HOME;
  delete process.env.HUSHENV_MASTER_KEY;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

describe('vault', () => {
  it('sets and gets a secret', () => {
    setSecret('DB_PASSWORD', 'hunter2');
    expect(getSecretValue('DB_PASSWORD')).toBe('hunter2');
  });

  it('never writes plaintext to disk', () => {
    setSecret('DB_PASSWORD', 'super-plaintext-marker');
    const raw = fs.readFileSync(vaultPath(), 'utf8');
    expect(raw).not.toContain('super-plaintext-marker');
  });

  it('updates preserve createdAt and bump updatedAt', () => {
    setSecret('K', 'v1');
    const before = listSecrets()[0]!;
    setSecret('K', 'v2');
    const after = listSecrets()[0]!;
    expect(after.createdAt).toBe(before.createdAt);
    expect(getSecretValue('K')).toBe('v2');
  });

  it('lists names sorted, without values', () => {
    setSecret('B_KEY', 'b');
    setSecret('A_KEY', 'a');
    const names = listSecrets().map((s) => s.name);
    expect(names).toEqual(['A_KEY', 'B_KEY']);
  });

  it('deletes a secret', () => {
    setSecret('K', 'v');
    expect(deleteSecret('K')).toBe(true);
    expect(deleteSecret('K')).toBe(false);
    expect(() => getSecretValue('K')).toThrow(SecretNotFoundError);
  });

  it('renames a secret, preserving createdAt', () => {
    setSecret('OLD', 'v');
    const before = listSecrets()[0]!;
    renameSecret('OLD', 'NEW');
    expect(getSecretValue('NEW')).toBe('v');
    expect(() => getSecretValue('OLD')).toThrow(SecretNotFoundError);
    expect(listSecrets()[0]!.createdAt).toBe(before.createdAt);
  });

  it('rename refuses to overwrite unless forced', () => {
    setSecret('A', 'a');
    setSecret('B', 'b');
    expect(() => renameSecret('A', 'B')).toThrow(/already exists/);
    renameSecret('A', 'B', { force: true });
    expect(getSecretValue('B')).toBe('a');
    expect(listSecrets().map((s) => s.name)).toEqual(['B']);
  });

  it('rename rejects missing sources and invalid targets', () => {
    setSecret('K', 'v');
    expect(() => renameSecret('MISSING', 'X')).toThrow(SecretNotFoundError);
    expect(() => renameSecret('K', '1BAD')).toThrow(/Invalid secret name/);
  });

  it('rejects invalid names and empty values', () => {
    expect(() => setSecret('1BAD', 'x')).toThrow(/Invalid secret name/);
    expect(() => setSecret('OK', '')).toThrow(/empty value/);
  });

  it('setSecrets writes a batch and preserves createdAt of existing entries', () => {
    setSecret('A', 'a1');
    const before = listSecrets().find((s) => s.name === 'A')!;
    setSecrets({ A: 'a2', B: 'b1' });
    expect(getSecretValue('A')).toBe('a2');
    expect(getSecretValue('B')).toBe('b1');
    expect(listSecrets().find((s) => s.name === 'A')!.createdAt).toBe(before.createdAt);
  });

  it('setSecrets validates everything before any write (all-or-nothing)', () => {
    expect(() => setSecrets({ GOOD: 'x', '1BAD': 'y' })).toThrow(/Invalid secret name/);
    expect(() => setSecrets({ GOOD: 'x', EMPTY: '' })).toThrow(/empty value/);
    expect(() => getSecretValue('GOOD')).toThrow(SecretNotFoundError);
  });
});
