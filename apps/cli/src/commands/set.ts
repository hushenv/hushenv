import { password } from '@inquirer/prompts';
import { setSecret } from '@hushenv/vault-core';

export interface SetOptions {
  stdin?: boolean;
}

export async function setCommand(
  name: string,
  positionalValue: string | undefined,
  opts: SetOptions,
): Promise<void> {
  let value: string;
  if (opts.stdin) {
    value = normalizeStdinValue(await readStdin());
  } else if (positionalValue !== undefined) {
    console.error(
      'Warning: the value was passed on the command line and may be stored in your shell history.',
    );
    console.error('Prefer `hushenv set NAME` (hidden prompt) or `--stdin`.');
    value = positionalValue;
  } else {
    value = await password({ message: `Value for ${name}:`, mask: '*' });
  }
  setSecret(name, value);
  console.log(`* Stored ${name} (encrypted).`);
}

/**
 * PowerShell 5.1 prepends a UTF-8 BOM when piping a string into a native
 * process, which would silently corrupt the stored secret.
 */
export function normalizeStdinValue(raw: string): string {
  return raw.replace(/^\uFEFF/, '').replace(/\r?\n$/, '');
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}
