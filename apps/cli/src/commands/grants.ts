import { listGrants } from '@hushenv/vault-core';

export function grantsCommand(): void {
  const entries = Object.entries(listGrants()).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    console.log('No grants. Every project can resolve any secret (unless strict is on).');
    return;
  }
  for (const [project, names] of entries) {
    console.log(project);
    console.log(`  ${names.join(', ')}`);
  }
}
