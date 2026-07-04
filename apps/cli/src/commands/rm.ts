import { deleteSecret } from '@hushenv/vault-core';
import { recordAudit } from '../audit.js';

export function rmCommand(name: string): void {
  if (deleteSecret(name)) {
    recordAudit('rm', { name });
    console.log(`* Removed ${name}.`);
  } else {
    console.error(`x Secret "${name}" not found.`);
    process.exitCode = 2;
  }
}
