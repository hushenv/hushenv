import { canonicalProject, grantProject, listSecrets } from '@hushenv/vault-core';
import { recordAudit } from '../audit.js';

export interface GrantOptions {
  project?: string;
}

export function grantCommand(names: string[], opts: GrantOptions): void {
  const project = canonicalProject(opts.project ?? process.cwd());
  const known = new Set(listSecrets().map((s) => s.name));
  const unknown = names.filter((n) => !known.has(n));
  if (unknown.length > 0) {
    console.error(
      `Warning: not in the vault yet (the grant still applies): ${unknown.join(', ')}`,
    );
  }
  grantProject(project, names);
  recordAudit('grant', { project, meta: { names } });
  console.log(`* Granted ${names.join(', ')} to ${project}.`);
}
