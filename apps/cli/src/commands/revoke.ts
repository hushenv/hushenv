import { canonicalProject, revokeProject } from '@hushenv/vault-core';
import { recordAudit } from '../audit.js';

export interface RevokeOptions {
  project?: string;
}

export function revokeCommand(names: string[], opts: RevokeOptions): void {
  const project = canonicalProject(opts.project ?? process.cwd());
  revokeProject(project, names);
  recordAudit('revoke', { project, meta: { names } });
  console.log(`* Revoked ${names.join(', ')} from ${project}.`);
}
