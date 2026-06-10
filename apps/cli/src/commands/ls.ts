import { listSecrets } from '@hushenv/vault-core';

export function lsCommand(): void {
  const secrets = listSecrets();
  if (secrets.length === 0) {
    console.log('Vault is empty. Add a secret with: hushenv set NAME');
    return;
  }
  const width = Math.max(...secrets.map((s) => s.name.length));
  for (const s of secrets) {
    console.log(`${s.name.padEnd(width)}  updated ${s.updatedAt.slice(0, 10)}`);
  }
}
