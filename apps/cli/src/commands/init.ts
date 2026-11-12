import {
  KeychainAccessError,
  KeychainUnavailableError,
  createAndStoreMasterKey,
  hasStoredMasterKey,
  initVault,
  loadVault,
  masterKeyFromEnv,
  vaultExists,
  vaultPath,
} from '@hushenv/vault-core';
import { recordAudit } from '../audit.js';

export function initCommand(): void {
  if (masterKeyFromEnv()) {
    console.log('Using master key from HUSHENV_MASTER_KEY (OS keychain skipped).');
  } else {
    let hasKey = false;
    let keychainError: KeychainAccessError | undefined;
    try {
      hasKey = hasStoredMasterKey();
    } catch (err) {
      if (!(err instanceof KeychainAccessError)) throw err;
      keychainError = err;
    }

    if (hasKey) {
      console.log('Master key already present in the OS keychain.');
    } else {
      // Never generate a key while the vault holds secrets: they are encrypted
      // under the existing key, and a new one would make them unrecoverable.
      const secrets = storedSecretCount();
      if (secrets > 0) {
        refuseNewKey(secrets, keychainError);
        return;
      }
      try {
        createAndStoreMasterKey();
        console.log('* Generated a master key and stored it in the OS keychain.');
      } catch (err) {
        if (err instanceof KeychainUnavailableError) {
          console.error(`x ${err.message}`);
          console.error(
            '\nFallback: add this to your shell profile, then re-run `hushenv init`:',
          );
          console.error(`  export HUSHENV_MASTER_KEY="${err.fallbackKey}"`);
          process.exitCode = 1;
          return;
        }
        throw err;
      }
    }
  }

  const { created } = initVault();
  recordAudit('init', { meta: { created } });
  console.log(
    created
      ? `* Created vault at ${vaultPath()}`
      : `Vault already exists at ${vaultPath()}`,
  );
  if (created) {
    console.log('\nNext steps:');
    console.log('  hushenv set MY_SECRET            # store a value (hidden prompt)');
    console.log('  echo {hushenv.MY_SECRET} in .env # reference it');
    console.log('  hushenv run -- pnpm dev          # run with secrets injected');
  }
}

function storedSecretCount(): number {
  if (!vaultExists()) return 0;
  return Object.keys(loadVault().secrets ?? {}).length;
}

function refuseNewKey(secrets: number, keychainError?: KeychainAccessError): void {
  const held = `the vault at ${vaultPath()} holds ${secrets} secret${secrets === 1 ? '' : 's'}`;
  if (keychainError) {
    console.error(`x ${keychainError.message}`);
    console.error(`\n  No new master key was generated: ${held}`);
    console.error('  encrypted under the existing key.');
  } else {
    console.error(`x No master key in the OS keychain, but ${held}.`);
    console.error('  A new key could not decrypt them, so none was generated.');
  }
  console.error('\n  If you have the original key, set HUSHENV_MASTER_KEY to it.');
  console.error(
    '  To start over without those secrets, move the vault file away, then re-run `hushenv init`.',
  );
  process.exitCode = 1;
}
