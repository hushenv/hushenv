# Contributing to hushenv

Thanks for considering a contribution — it's a small, readable codebase and
PRs are welcome.

## Dev setup

Requires Node ≥ 20 and pnpm (version pinned in the root `packageManager`
field — `corepack enable` handles it).

```bash
pnpm install
pnpm -r build
pnpm -r test          # vitest, no keychain needed (tests use HUSHENV_MASTER_KEY)
```

Run the CLI from source:

```bash
pnpm --filter hushenv dev -- --help
```

To try commands against a throwaway vault without touching your real one,
set `HUSHENV_HOME` to a temp dir and `HUSHENV_MASTER_KEY` to any 32-byte
base64 value.

## Repo layout — and the one architectural rule

```
packages/vault-core   engine: crypto, keychain, vault storage
apps/cli              the hushenv CLI: ref resolution, run, prompts
```

**`vault-core` never imports anything env-file- or CLI-specific.** It doesn't
know what a `.env` file or a `{hushenv.X}` ref is. Future surfaces (tray UI,
MCP broker) sit on the same engine, so anything env- or terminal-flavored
belongs in `apps/cli`. PRs that leak CLI concepts into the engine will be
asked to move them.

## Tests

- `packages/vault-core/test/` — crypto + vault behavior
- `apps/cli/test/` — ref resolution, stdin normalization

Add tests with the change; `pnpm -r test` must be green.

## Releases (maintainers)

Publishing is fully automated via npm Trusted Publishing — no tokens:

1. Bump `version` in `packages/vault-core/package.json` **and**
   `apps/cli/package.json` (they ship in lockstep).
2. Commit, then `git tag v0.x.y && git push && git push --tags`.
3. The [publish workflow](.github/workflows/publish.yml) builds, tests, and
   publishes both packages with provenance. Already-published versions are
   skipped, so re-running is safe.

## License

By contributing, you agree your contributions are licensed under
[Apache-2.0](LICENSE), the project license.
