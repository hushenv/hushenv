import { renameSecret } from '@hushenv/vault-core';

export interface MvOptions {
  force?: boolean;
}

export function mvCommand(oldName: string, newName: string, opts: MvOptions): void {
  renameSecret(oldName, newName, { force: opts.force });
  if (oldName === newName) {
    console.log(`* ${oldName} unchanged.`);
  } else {
    console.log(`* Renamed ${oldName} -> ${newName}.`);
  }
}
