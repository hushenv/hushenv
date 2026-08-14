---
"hushenv": minor
"@hushenv/vault-core": minor
---

Add **per-project grants** with strict mode — the final v1 feature. Authorize
which secrets a project directory may resolve at `run` time; ungranted refs are
blocked (exit 2) with a `hushenv grant` hint.

- `hushenv grant <name...>` / `revoke <name...>` (`--project <dir>`),
  `hushenv grants` (list, never values), `hushenv strict [on|off]`.
- **Exact-directory** matching (canonical path). A project with any grant is
  scoped to exactly its allow-list; projects with no grants follow the global
  `strict` setting (off by default — backwards-compatible; on blocks them).
- `run` enforces grants before spawning; blocked attempts are audited.
- This closes the "`hushenv run -- env` exposes every secret" gap for scoped
  projects.

`vault-core` gains `grantProject`/`revokeProject`/`listGrants`/`isGranted`,
`getStrict`/`setStrict`, `canonicalProject`, and the `deniedNames` enforcement
helper; `VaultFile` gains an optional additive `settings.strict`.
