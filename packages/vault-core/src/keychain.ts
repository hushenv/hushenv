import { createRequire } from 'node:module';
import { generateKey, KEY_BYTES } from './crypto.js';
import { KeychainUnavailableError, NotInitializedError } from './errors.js';

const SERVICE = 'hushenv';
const ACCOUNT = 'master';

const require = createRequire(import.meta.url);

interface KeyringEntry {
  getPassword(): string | null;
  setPassword(password: string): void;
  deletePassword(): boolean;
}

function keyringEntry(): KeyringEntry {
  const { Entry } = require('@napi-rs/keyring') as {
    Entry: new (service: string, account: string) => KeyringEntry;
  };
  return new Entry(SERVICE, ACCOUNT);
}

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

/** Env var first (CI / no-keychain machines), then the OS keychain. */
export function getMasterKey(): Buffer {
  const fromEnv = masterKeyFromEnv();
  if (fromEnv) return fromEnv;

  let stored: string | null = null;
  try {
    stored = keyringEntry().getPassword();
  } catch {
    stored = null;
  }
  if (!stored) {
    throw new NotInitializedError(
      'No master key found. Run `hushenv init` (or set HUSHENV_MASTER_KEY).'
    );
  }
  const buf = Buffer.from(stored, 'base64');
  if (buf.length !== KEY_BYTES) {
    throw new Error('Stored master key is corrupt (unexpected length).');
  }
  return buf;
}

export function hasStoredMasterKey(): boolean {
  try {
    return Boolean(keyringEntry().getPassword());
  } catch {
    return false;
  }
}

/**
 * Generates a fresh key and stores it in the OS keychain. If no keychain is
 * reachable, throws KeychainUnavailableError carrying the generated key so
 * the caller can offer the HUSHENV_MASTER_KEY fallback.
 */
export function createAndStoreMasterKey(): void {
  const key = generateKey();
  try {
    keyringEntry().setPassword(key.toString('base64'));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new KeychainUnavailableError(
      `Could not store the master key in the OS keychain (${reason}).`,
      key.toString('base64')
    );
  }
}
