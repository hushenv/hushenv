import { deleteSecret } from '@hushenv/vault-core';

export function rmCommand(name: string): void {
  if (deleteSecret(name)) {
    console.log(`* Removed ${name}.`);
  } else {
    console.error(`x Secret "${name}" not found.`);
    process.exitCode = 2;
  }
}
