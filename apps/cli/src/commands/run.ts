import spawn from 'cross-spawn';
import { decryptValue, getMasterKey, loadVault } from '@hushenv/vault-core';
import { loadEnvFiles } from '../env-files.js';
import { resolveRefs } from '../resolve.js';

/**
 * The core invariant: plaintext exists only in the child process
 * environment, in memory, at exec time. Nothing resolved is ever written to
 * disk.
 */
export function runCommand(files: string[], cmd: string[]): void {
  if (cmd.length === 0) {
    throw new Error('No command given. Usage: hushenv run [-f file] -- <command...>');
  }

  const raw = loadEnvFiles(files);

  const key = getMasterKey();
  const vault = loadVault();
  const { resolved, missing } = resolveRefs(raw, (name) => {
    const entry = vault.secrets[name];
    return entry ? decryptValue(key, name, entry) : undefined;
  });

  if (missing.length > 0) {
    console.error(`x ${missing.length} secret(s) referenced but not in the vault:`);
    for (const name of missing) console.error(`    ${name}`);
    console.error('\n  Add them with:');
    for (const name of missing) console.error(`    hushenv set ${name}`);
    process.exitCode = 2;
    return;
  }

  const childEnv = { ...resolved, ...process.env };
  const child = spawn(cmd[0] as string, cmd.slice(1), {
    stdio: 'inherit',
    env: childEnv,
  });

  child.on('error', (err) => {
    console.error(`x Failed to start "${cmd[0]}": ${err.message}`);
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    process.exitCode = signal ? 1 : (code ?? 1);
  });
}
