import { generateKey, KEY_BYTES } from './crypto.js';
import {
  KeychainAccessError,
  KeychainUnavailableError,
  NotInitializedError,
} from './errors.js';
import { loadKeyringEntry } from './keyring-loader.js';

const SERVICE = 'hushenv';
const ACCOUNT = 'master';

/** Returns the key from HUSHENV_MASTER_KEY, or null if unset. */
export function masterKeyFromEnv(): Buffer | null {
  const raw = process.env.HUSHENV_MASTER_KEY;
  if (!raw) return null;
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== KEY_BYTES) {
    throw new Error('HUSHENV_MASTER_KEY must be 32 bytes, base64-encoded.');
  }
  return buf;
}

/**
 * Reads the stored key. Returns null only when the keychain answered "no such
 * entry". A keychain that cannot be read (locked, no secret service, native
 * module failed to load) throws KeychainAccessError instead: "unreadable" must
 * never be mistaken for "absent", or a caller could replace a key that still
 * protects the vault.
 */
function readStoredKey(): string | null {
  try {
    return loadKeyringEntry(SERVICE, ACCOUNT).getPassword();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new KeychainAccessError(
      `Could not read the master key from the OS keychain (${reason}). ` +
        'If the keychain is locked, unlock it and retry. ' +
        'On a machine without a keychain, set HUSHENV_MASTER_KEY.',
    );
  }
}

/** Env var first (CI / no-keychain machines), then the OS keychain. */
export function getMasterKey(): Buffer {
  const fromEnv = masterKeyFromEnv();
  if (fromEnv) return fromEnv;

  const stored = readStoredKey();
  if (!stored) {
    throw new NotInitializedError(
      'No master key found. Run `hushenv init` (or set HUSHENV_MASTER_KEY).',
    );
  }
  const buf = Buffer.from(stored, 'base64');
  if (buf.length !== KEY_BYTES) {
    throw new Error('Stored master key is corrupt (unexpected length).');
  }
  return buf;
}

/**
 * True if the OS keychain holds a master key, false if it holds none.
 * Throws KeychainAccessError when the keychain cannot be read, so callers
 * cannot treat an unreadable keychain as an empty one.
 */
export function hasStoredMasterKey(): boolean {
  return Boolean(readStoredKey());
}

/**
 * Generates a fresh key and stores it in the OS keychain, replacing any key
 * already there. If no keychain is reachable, throws KeychainUnavailableError
 * carrying the generated key so the caller can offer the HUSHENV_MASTER_KEY
 * fallback.
 */
export function createAndStoreMasterKey(): void {
  const key = generateKey();
  try {
    loadKeyringEntry(SERVICE, ACCOUNT).setPassword(key.toString('base64'));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new KeychainUnavailableError(
      `Could not store the master key in the OS keychain (${reason}).`,
      key.toString('base64'),
    );
  }
}
