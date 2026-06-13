---
"hushenv": minor
"@hushenv/vault-core": minor
---

Add the `mv` command (alias `rename`) to rename a secret. The value is
re-encrypted under the new name (AES-256-GCM binds the ciphertext to its name),
`createdAt` is preserved, and `--force` overwrites an existing destination.
