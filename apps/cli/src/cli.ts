#!/usr/bin/env node
import { Command } from 'commander';
import { NotInitializedError, SecretNotFoundError } from '@hushenv/vault-core';
import { getCommand } from './commands/get.js';
import { initCommand } from './commands/init.js';
import { lsCommand } from './commands/ls.js';
import { mvCommand } from './commands/mv.js';
import { rmCommand } from './commands/rm.js';
import { runCommand } from './commands/run.js';
import { setCommand } from './commands/set.js';

const program = new Command();

program
  .name('hushenv')
  .description(
    'Local secret manager for the agent era.\nYour .env holds {hushenv.X} refs; plaintext exists only in child process memory.',
  )
  .version('0.1.0')
  .enablePositionalOptions()
  .showHelpAfterError();

program
  .command('init')
  .description('Create the master key (OS keychain) and an empty vault')
  .action(initCommand);

program
  .command('set')
  .description('Store a secret (hidden prompt by default)')
  .argument('<name>', 'secret name, e.g. DB_PASSWORD')
  .argument('[value]', 'value (discouraged: lands in shell history)')
  .option('--stdin', 'read the value from stdin')
  .action(setCommand);

program
  .command('get')
  .description('Reveal a secret (interactive confirmation required)')
  .argument('<name>')
  .option('--force', 'skip the TTY confirmation gate')
  .action(getCommand);

program.command('ls').description('List secret names (never values)').action(lsCommand);

program.command('rm').description('Delete a secret').argument('<name>').action(rmCommand);

program
  .command('mv')
  .alias('rename')
  .description('Rename a secret (the value is re-encrypted under the new name)')
  .argument('<old>', 'current secret name')
  .argument('<new>', 'new secret name')
  .option('--force', 'overwrite <new> if it already exists')
  .action(mvCommand);

program
  .command('run')
  .description('Resolve {hushenv.X} refs from env file(s) and run a command')
  .option('-f, --file <path>', 'env file to load (repeatable; first wins)', collect, [])
  .passThroughOptions()
  .argument('<cmd...>', 'command to run, after --')
  .action((cmd: string[], opts: { file: string[] }) => {
    const files = opts.file.length > 0 ? opts.file : ['.env'];
    runCommand(files, cmd);
  });

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

try {
  await program.parseAsync(process.argv);
} catch (err) {
  handleError(err);
}

function handleError(err: unknown): void {
  if (err instanceof SecretNotFoundError) {
    console.error(`x ${err.message}`);
    process.exitCode = 2;
  } else if (err instanceof NotInitializedError) {
    console.error(`x ${err.message}`);
    process.exitCode = 1;
  } else if (err instanceof Error && err.name === 'ExitPromptError') {
    process.exitCode = 1;
  } else {
    console.error(`x ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}
