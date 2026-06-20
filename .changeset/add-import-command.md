---
"hushenv": minor
"@hushenv/vault-core": minor
---

Add the `hushenv import` command to migrate an existing `.env` into the vault.
It vaults plaintext values (heuristically pre-selecting secret-like ones, leaving
config such as localhost URLs literal) and rewrites the file to `{hushenv.X}`
refs in place, preserving comments, ordering, and EOL style. Supports
`--dry-run`, `--all` (non-interactive), `--force`/`--skip-existing` for
conflicts, and `--prefix` to namespace imported names. Re-running is an
idempotent no-op. The vault is written and round-trip verified before the file
is touched, and no `.env` backup is written (so plaintext is never persisted).

`vault-core` gains a `setSecrets()` batch writer (one atomic save for N secrets)
and an `isValidName()` predicate.
