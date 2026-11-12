---
"hushenv": patch
"@hushenv/vault-core": patch
---

Fix `hushenv init` being able to replace a master key that still protects the
vault, which made every stored secret unrecoverable.

- A keychain that cannot be read (locked, no secret service, native module
  failed to load) is no longer treated as "no key stored".
- `init` never generates a new key while the vault holds secrets. It stops with
  an explanation instead; an empty or missing vault behaves as before, including
  the `HUSHENV_MASTER_KEY` fallback on machines without a keychain.
- `run`/`get`/`set` now report "could not read the OS keychain" with the
  underlying reason, instead of telling you to run `hushenv init`.

`vault-core` gains `KeychainAccessError`. `hasStoredMasterKey()` and
`getMasterKey()` now throw it when the keychain is unreadable (previously
`false` / `NotInitializedError`).
