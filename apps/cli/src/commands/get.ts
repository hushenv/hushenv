import { confirm } from '@inquirer/prompts';
import { getSecretValue } from '@hushenv/vault-core';

export interface GetOptions {
  force?: boolean;
}

/**
 * TTY gate: revealing plaintext requires an interactive terminal unless
 * --force is passed. Non-interactive shells (CI, agents) fail the gate by
 * design.
 */
export async function getCommand(name: string, opts: GetOptions): Promise<void> {
  if (!opts.force) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      console.error(
        'x `hushenv get` reveals plaintext and requires an interactive terminal.',
      );
      console.error('  Non-interactive callers must pass --force explicitly.');
      process.exitCode = 1;
      return;
    }
    const ok = await confirm({
      message: `Reveal "${name}" in plaintext?`,
      default: false,
    });
    if (!ok) {
      console.error('Aborted.');
      process.exitCode = 1;
      return;
    }
  }
  process.stdout.write(getSecretValue(name) + '\n');
}
