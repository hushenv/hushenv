# Contributing to hushenv

Thanks for considering a contribution — it's a small, readable codebase and
PRs are welcome.

## Dev setup

Requires Node ≥ 20 and pnpm (version pinned in the root `packageManager`
field — `corepack enable` handles it).

```bash
pnpm install
pnpm lint             # Biome: format + lint (use `pnpm format` to auto-fix)
pnpm -r typecheck     # tsc --noEmit
pnpm -r build
pnpm -r test          # vitest, no keychain needed (tests use HUSHENV_MASTER_KEY)
```

CI runs the same checks on every PR across Node 20 and 24 (Linux, Windows, macOS).

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

## Changesets

Any PR that changes published behavior needs a changeset:

```bash
pnpm changeset
```

Pick the bump type — both packages move together (`fixed` lockstep), so a single
choice versions both — and write a one-line summary. Commit the generated file
in `.changeset/`. Docs-only or chore PRs don't need one.

## Releases (maintainers)

Releases are automated with [Changesets](https://github.com/changesets/changesets)
and npm Trusted Publishing — no tokens, no hand-edited versions, no manual tags:

1. On merge to `main`, the [publish workflow](.github/workflows/publish.yml)
   opens (or updates) a **"Version Packages"** PR that bumps both
   `package.json`s and rewrites the changelogs from the pending changesets.
2. Merging that PR builds, tests, and publishes both packages to npm with
   provenance (OIDC Trusted Publishing), tags `vX.Y.Z`, and cuts a GitHub
   Release with a CycloneDX SBOM attached.
3. Already-published versions are skipped, so re-runs are safe.

## License

By contributing, you agree your contributions are licensed under
[Apache-2.0](LICENSE), the project license.
