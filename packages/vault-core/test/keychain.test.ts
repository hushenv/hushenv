import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  KeychainAccessError,
  KeychainUnavailableError,
  NotInitializedError,
  createAndStoreMasterKey,
  getMasterKey,
  hasStoredMasterKey,
} from '../src/index';
import { loadKeyringEntry } from '../src/keyring-loader';

// Replace the OS keychain so these tests never read or write the real one.
vi.mock('../src/keyring-loader', () => ({ loadKeyringEntry: vi.fn() }));

const loader = vi.mocked(loadKeyringEntry);

function keychain(getPassword: () => string | null) {
  const entry = { getPassword, setPassword: vi.fn(), deletePassword: vi.fn() };
  loader.mockReturnValue(entry);
  return entry;
}

const locked = () => {
  throw new Error('keychain is locked');
};

beforeEach(() => {
  // Fail loudly rather than fall through to the real keychain.
  if (!vi.isMockFunction(loadKeyringEntry)) {
    throw new Error('keyring-loader is not mocked');
  }
  loader.mockReset();
  delete process.env.HUSHENV_MASTER_KEY;
});

describe('keychain', () => {
  it('returns the stored key', () => {
    const key = randomBytes(32);
    keychain(() => key.toString('base64'));
    expect(getMasterKey().equals(key)).toBe(true);
    expect(hasStoredMasterKey()).toBe(true);
  });

  it('reports "no key" only when the keychain says there is no entry', () => {
    keychain(() => null);
    expect(hasStoredMasterKey()).toBe(false);
    expect(() => getMasterKey()).toThrow(NotInitializedError);
  });

  it('does not treat an unreadable keychain as an empty one', () => {
    keychain(locked);
    expect(() => hasStoredMasterKey()).toThrow(KeychainAccessError);
    expect(() => getMasterKey()).toThrow(KeychainAccessError);
    expect(() => getMasterKey()).toThrow(/keychain is locked/);
  });

  it('reports a keyring module that fails to load as unreadable', () => {
    loader.mockImplementation(() => {
      throw new Error('native module missing');
    });
    expect(() => hasStoredMasterKey()).toThrow(KeychainAccessError);
  });

  it('prefers HUSHENV_MASTER_KEY and never touches the keychain', () => {
    const key = randomBytes(32);
    process.env.HUSHENV_MASTER_KEY = key.toString('base64');
    expect(getMasterKey().equals(key)).toBe(true);
    expect(loader).not.toHaveBeenCalled();
  });

  it('stores a generated 32-byte key', () => {
    const entry = keychain(() => null);
    createAndStoreMasterKey();
    const stored = entry.setPassword.mock.calls[0]?.[0] as string;
    expect(Buffer.from(stored, 'base64')).toHaveLength(32);
  });

  it('hands back the generated key when the keychain cannot store it', () => {
    const entry = keychain(() => null);
    entry.setPassword.mockImplementation(locked);
    let caught: unknown;
    try {
      createAndStoreMasterKey();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(KeychainUnavailableError);
    const fallback = (caught as KeychainUnavailableError).fallbackKey;
    expect(Buffer.from(fallback, 'base64')).toHaveLength(32);
  });
});
