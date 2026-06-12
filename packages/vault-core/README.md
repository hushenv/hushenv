# @hushenv/vault-core

The engine behind [hushenv](https://www.npmjs.com/package/hushenv) — if you just want to manage secrets for your `.env` files, install the `hushenv` CLI instead.

This package provides the storage and crypto layer, with no env-file or CLI knowledge:

- **AES-256-GCM vault** at `~/.hushenv/vault.json` (override with `HUSHENV_HOME`)
- **Master key in the OS keychain** (macOS Keychain / Windows Credential Manager via `@napi-rs/keyring`), with a `HUSHENV_MASTER_KEY` env fallback for CI and containers
- **Name-bound encryption** — AES-GCM AAD ties each ciphertext to its secret name, so entries can't be swapped

## API sketch

```ts
import {
  initVault,
  setSecret,
  getSecretValue,
  listSecrets,
  deleteSecret,
  createAndStoreMasterKey,
  getMasterKey,
} from '@hushenv/vault-core';

initVault();                       // create an empty vault (key must exist)
setSecret('DB_PASSWORD', 'hunter2');
getSecretValue('DB_PASSWORD');     // 'hunter2'
listSecrets();                     // [{ name, createdAt, updatedAt }] — never values
deleteSecret('DB_PASSWORD');
```

Errors are typed: `NotInitializedError`, `SecretNotFoundError`, `KeychainUnavailableError`.

Future surfaces (tray UI, MCP broker) sit on this same engine.

## License

Apache-2.0 © Simplyxity Ltd
