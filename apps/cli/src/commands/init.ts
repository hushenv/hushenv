import {
  KeychainUnavailableError,
  createAndStoreMasterKey,
  hasStoredMasterKey,
  initVault,
  masterKeyFromEnv,
  vaultPath,
} from '@hushenv/vault-core';

export function initCommand(): void {
  if (masterKeyFromEnv()) {
    console.log('Using master key from HUSHENV_MASTER_KEY (OS keychain skipped).');
  } else if (hasStoredMasterKey()) {
    console.log('Master key already present in the OS keychain.');
  } else {
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

  const { created } = initVault();
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
