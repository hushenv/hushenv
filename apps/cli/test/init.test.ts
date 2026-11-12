import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  KeychainAccessError,
  KeychainUnavailableError,
  createAndStoreMasterKey,
  hasStoredMasterKey,
  initVault,
  setSecret,
  vaultExists,
} from '@hushenv/vault-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initCommand } from '../src/commands/init';

// Replace the two keychain calls so these tests never touch the real keychain.
vi.mock('@hushenv/vault-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@hushenv/vault-core')>()),
  hasStoredMasterKey: vi.fn(),
  createAndStoreMasterKey: vi.fn(),
}));

// The audit append would otherwise look the key up in the real keychain.
vi.mock('../src/audit', () => ({ recordAudit: vi.fn() }));

const hasKey = vi.mocked(hasStoredMasterKey);
const createKey = vi.mocked(createAndStoreMasterKey);

let tmpHome: string;
let errors: string;

/** A vault holding one secret, written under a key the keychain no longer has. */
function seedVaultWithSecret(): void {
  process.env.HUSHENV_MASTER_KEY = randomBytes(32).toString('base64');
  initVault();
  setSecret('DB_PASSWORD', 'hunter2');
  delete process.env.HUSHENV_MASTER_KEY;
}

beforeEach(() => {
  // Fail loudly rather than fall through to the real keychain.
  if (!vi.isMockFunction(createAndStoreMasterKey)) {
    throw new Error('vault-core keychain functions are not mocked');
  }
  hasKey.mockReset();
  createKey.mockReset();
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hushenv-init-'));
  process.env.HUSHENV_HOME = tmpHome;
  delete process.env.HUSHENV_MASTER_KEY;
  process.exitCode = undefined;
  errors = '';
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    errors += `${args.join(' ')}\n`;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.HUSHENV_HOME;
  delete process.env.HUSHENV_MASTER_KEY;
  process.exitCode = undefined;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

describe('init', () => {
  it('first run: generates a key and creates the vault', () => {
    hasKey.mockReturnValue(false);
    initCommand();
    expect(createKey).toHaveBeenCalledOnce();
    expect(vaultExists()).toBe(true);
  });

  it('keeps an existing key', () => {
    hasKey.mockReturnValue(true);
    initCommand();
    expect(createKey).not.toHaveBeenCalled();
    expect(vaultExists()).toBe(true);
    expect(process.exitCode).toBeUndefined();
  });

  it('refuses a new key when the keychain is unreadable and the vault has secrets', () => {
    seedVaultWithSecret();
    hasKey.mockImplementation(() => {
      throw new KeychainAccessError('Could not read the OS keychain (locked).');
    });
    initCommand();
    expect(createKey).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(errors).toContain('Could not read the OS keychain (locked).');
    expect(errors).toContain('holds 1 secret');
  });

  it('refuses a new key when the key is gone but the vault has secrets', () => {
    seedVaultWithSecret();
    hasKey.mockReturnValue(false);
    initCommand();
    expect(createKey).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(errors).toContain('No master key in the OS keychain');
    expect(errors).toContain('HUSHENV_MASTER_KEY');
  });

  it('regenerates a missing key when the vault is empty', () => {
    process.env.HUSHENV_MASTER_KEY = randomBytes(32).toString('base64');
    initVault();
    delete process.env.HUSHENV_MASTER_KEY;
    hasKey.mockReturnValue(false);
    initCommand();
    expect(createKey).toHaveBeenCalledOnce();
  });

  it('no keychain and no vault: still offers the HUSHENV_MASTER_KEY fallback', () => {
    hasKey.mockImplementation(() => {
      throw new KeychainAccessError('Could not read the OS keychain (no service).');
    });
    createKey.mockImplementation(() => {
      throw new KeychainUnavailableError('Could not store the master key.', 'FALLBACK');
    });
    initCommand();
    expect(process.exitCode).toBe(1);
    expect(errors).toContain('export HUSHENV_MASTER_KEY="FALLBACK"');
    expect(vaultExists()).toBe(false);
  });

  it('uses HUSHENV_MASTER_KEY without consulting the keychain', () => {
    process.env.HUSHENV_MASTER_KEY = randomBytes(32).toString('base64');
    initCommand();
    expect(hasKey).not.toHaveBeenCalled();
    expect(createKey).not.toHaveBeenCalled();
    expect(vaultExists()).toBe(true);
  });
});
