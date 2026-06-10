import fs from 'node:fs';
import path from 'node:path';
import { decryptValue, encryptValue } from './crypto.js';
import { NotInitializedError, SecretNotFoundError } from './errors.js';
import { getMasterKey } from './keychain.js';
import { hushenvHome, vaultPath } from './paths.js';
import type { SecretEntry, VaultFile } from './types.js';

const NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function emptyVault(): VaultFile {
  return { version: 1, secrets: {}, grants: {} };
}

export function vaultExists(): boolean {
  return fs.existsSync(vaultPath());
}

export function loadVault(): VaultFile {
  if (!vaultExists()) {
    throw new NotInitializedError('Vault not found. Run `hushenv init` first.');
  }
  const data = JSON.parse(fs.readFileSync(vaultPath(), 'utf8')) as VaultFile;
  if (data.version !== 1) {
    throw new Error(`Unsupported vault version: ${String((data as { version: unknown }).version)}`);
  }
  return data;
}

/** Atomic write: temp file + rename. Dir 0700, file 0600 (no-ops on Windows). */
export function saveVault(vault: VaultFile): void {
  const dir = hushenvHome();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmp = path.join(dir, `.vault.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(vault, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, vaultPath());
}

export function assertValidName(name: string): void {
  if (!NAME_RE.test(name)) {
    throw new Error(
      `Invalid secret name "${name}". Use letters, digits and underscores, not starting with a digit.`
    );
  }
}

export function setSecret(name: string, value: string): void {
  assertValidName(name);
  if (value.length === 0) throw new Error('Refusing to store an empty value.');
  const key = getMasterKey();
  const vault = loadVault();
  const now = new Date().toISOString();
  const existing: SecretEntry | undefined = vault.secrets[name];
  vault.secrets[name] = {
    ...encryptValue(key, name, value),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  saveVault(vault);
}

export function getSecretValue(name: string): string {
  const key = getMasterKey();
  const vault = loadVault();
  const entry = vault.secrets[name];
  if (!entry) throw new SecretNotFoundError(name);
  return decryptValue(key, name, entry);
}

export function listSecrets(): Array<{ name: string; createdAt: string; updatedAt: string }> {
  const vault = loadVault();
  return Object.entries(vault.secrets)
    .map(([name, e]) => ({ name, createdAt: e.createdAt, updatedAt: e.updatedAt }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function deleteSecret(name: string): boolean {
  const vault = loadVault();
  if (!vault.secrets[name]) return false;
  delete vault.secrets[name];
  saveVault(vault);
  return true;
}

export function initVault(): { created: boolean } {
  if (vaultExists()) return { created: false };
  saveVault(emptyVault());
  return { created: true };
}
