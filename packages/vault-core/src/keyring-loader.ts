import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export interface KeyringEntry {
  /** null when the keychain has no such entry; throws when it cannot be read. */
  getPassword(): string | null;
  setPassword(password: string): void;
  deletePassword(): boolean;
}

/**
 * Loads the native keyring module on first use, so the HUSHENV_MASTER_KEY path
 * never touches it. Kept in its own module so tests can replace the keychain.
 */
export function loadKeyringEntry(service: string, account: string): KeyringEntry {
  const { Entry } = require('@napi-rs/keyring') as {
    Entry: new (service: string, account: string) => KeyringEntry;
  };
  return new Entry(service, account);
}
