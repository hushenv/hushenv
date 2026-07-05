import os from 'node:os';
import path from 'node:path';

/** Override with HUSHENV_HOME (used by tests and CI). */
export function hushenvHome(): string {
  return process.env.HUSHENV_HOME ?? path.join(os.homedir(), '.hushenv');
}

export function vaultPath(): string {
  return path.join(hushenvHome(), 'vault.json');
}

export function auditPath(): string {
  return path.join(hushenvHome(), 'audit.log');
}

export function auditLockPath(): string {
  return path.join(hushenvHome(), 'audit.log.lock');
}
