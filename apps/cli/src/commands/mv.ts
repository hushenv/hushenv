import { renameSecret } from '@hushenv/vault-core';
import { recordAudit } from '../audit.js';

export interface MvOptions {
  force?: boolean;
}

export function mvCommand(oldName: string, newName: string, opts: MvOptions): void {
  renameSecret(oldName, newName, { force: opts.force });
  if (oldName === newName) {
    console.log(`* ${oldName} unchanged.`);
  } else {
    recordAudit('mv', { name: oldName, meta: { to: newName } });
    console.log(`* Renamed ${oldName} -> ${newName}.`);
  }
}
