# hushenv

[![npm version](https://img.shields.io/npm/v/hushenv)](https://www.npmjs.com/package/hushenv)
[![CI](https://github.com/hushenv/hushenv/actions/workflows/ci.yml/badge.svg)](https://github.com/hushenv/hushenv/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/hushenv/hushenv/badge)](https://scorecard.dev/viewer/?uri=github.com/hushenv/hushenv)
[![license](https://img.shields.io/npm/l/hushenv)](https://github.com/hushenv/hushenv/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/hushenv)](https://www.npmjs.com/package/hushenv)
[![provenance](https://img.shields.io/badge/npm-provenance-blue)](https://www.npmjs.com/package/hushenv)

Keeps your secrets hush-hush 🤫 — a local secret manager for the agent era, starting with your `.env`.

Your `.env` files hold **references**, not secrets:

```dotenv
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL=postgres://app:{hushenv.DB_PASSWORD}@localhost:5432/app
RESEND_KEY={hushenv.RESEND_KEY}
```

Real values live AES-256-GCM-encrypted in `~/.hushenv/vault.json`, with the
master key in your OS keychain (macOS Keychain / Windows Credential Manager).
Plaintext exists in exactly one place: the child process environment, in
memory, at `hushenv run` time. The `.env` file is safe to commit and safe for
AI agents to read.

## Quickstart

```bash
npm i -g hushenv

hushenv init                       # master key -> OS keychain, empty vault
hushenv set DB_PASSWORD            # hidden prompt
hushenv set RESEND_KEY --stdin     # or pipe it in
hushenv run -- pnpm dev            # resolves refs from ./.env, injects, runs
hushenv run -f .env.local -- pnpm dev
```

## Migrating an existing `.env`

Already have a populated `.env`? `import` moves the real values into the vault
and rewrites the file to refs, in one step:

```bash
hushenv import --dry-run            # preview: what gets vaulted vs left literal
hushenv import                      # interactive: pick which values to vault
hushenv import --all                # non-interactive: take the heuristics
```

It vaults values that look like secrets and leaves config (e.g.
`NEXTAUTH_URL=http://localhost:3000`) literal — review the picks in the
interactive prompt or with `--dry-run`. Re-running is a safe no-op (refs are
skipped). Two things to know:

- It vaults **whole values**. A secret embedded in a larger string (e.g. the
  password inside a `DATABASE_URL`) is vaulted whole or skipped — split those by
  hand into their own `{hushenv.X}` ref.
- If the `.env` was ever committed, the old plaintext is in your git history —
  **rotate** those secrets after importing.

## Commands

| Command | What it does |
|---|---|
| `hushenv init` | Create the master key (keychain) and an empty vault |
| `hushenv set <name> [value]` | Store a secret. Hidden prompt by default; `--stdin` to pipe. Positional value is discouraged (shell history). |
| `hushenv get <name>` | Reveal a value. Requires an interactive TTY + confirmation; `--force` to bypass (use sparingly). |
| `hushenv ls` | List names and update dates. Never values. |
| `hushenv rm <name>` | Delete a secret |
| `hushenv mv <old> <new>` | Rename a secret (alias: `rename`). Re-encrypted under the new name; `--force` to overwrite. |
| `hushenv import [-f file]` | Migrate plaintext values from an `.env` into the vault, rewriting them to refs. `--dry-run`, `--all`, `--force`/`--skip-existing`, `--prefix`. |
| `hushenv run [-f file]... -- <cmd>` | Resolve refs and run the command with secrets injected |

Reference syntax: `{hushenv.NAME}` — whole-value or embedded inside a larger
string. `{mysm.NAME}` and `{mysmtool.NAME}` are accepted as legacy aliases.

## Use with your stack

`hushenv run` injects resolved secrets into the environment of **any** child
process — your app's language doesn't matter:

```bash
hushenv run -- <your dev command>
```

Per-stack recipes with the framework-specific details:

| Stack | Guide |
|---|---|
| Next.js | [docs/nextjs.md](docs/nextjs.md) |
| NestJS | [docs/nestjs.md](docs/nestjs.md) |
| Express / plain Node | [docs/express.md](docs/express.md) |
| Vite | [docs/vite.md](docs/vite.md) |
| Python (FastAPI / Django / Flask) | [docs/python.md](docs/python.md) |
| Go | [docs/go.md](docs/go.md) |
| PHP / Laravel | [docs/php-laravel.md](docs/php-laravel.md) |
| Ruby / Rails | [docs/ruby-rails.md](docs/ruby-rails.md) |
| Rust | [docs/rust.md](docs/rust.md) |

They all work for the same reason: every mainstream dotenv loader (Node
dotenv, python-dotenv, godotenv, phpdotenv, dotenv-rails, dotenvy) refuses to
overwrite environment variables that already exist — and hushenv sets the real
values *before* your app starts. Your framework keeps its `.env` loading;
the ref strings in the file are simply never used.

## Semantics

- Multiple `-f` files: loaded in order, the **first** occurrence of a key wins.
- Existing `process.env` variables are **not** overridden by file values
  (dotenv convention).
- Missing refs **fail fast** before your app starts, with the exact
  `hushenv set` commands to fix it. Exit code 2.
- Exit codes: `0` ok · `1` error · `2` missing secret.

## How it compares

| | Plaintext on disk | `.env` safe to commit | Agent-safe `.env` | Works offline | Price |
|---|---|---|---|---|---|
| plain `.env` + dotenv | yes 😬 | no | no | yes | free |
| **hushenv** | no — AES-256-GCM vault, key in OS keychain | yes — refs only | yes | yes | free |
| dotenvx | no — ciphertext in `.env` | yes — ciphertext | partly — private key sits in `.env.keys` | yes | free core, paid sync |
| 1Password `op run` | no | yes — `op://` refs | yes | mostly | subscription |
| cloud secret managers | no | n/a | yes | no | usage-based |

Honest take: if your team needs shared secrets **today**, dotenvx sync or a
cloud manager solves that and hushenv doesn't yet — team sync is what
hushenv Cloud (closed-source, paid) will add on top of this free core.

## No keychain? (CI, containers)

Set the master key via the environment instead:

```bash
export HUSHENV_MASTER_KEY="<32 bytes, base64>"
```

`hushenv init` prints exactly this fallback if no OS keychain is reachable.

## Security model — honest version

What this protects against:

- Agents or tools reading secrets from `.env` files (they only see refs)
- Secrets leaking into git history
- Vault file theft without the OS keychain (ciphertext only)
- Ciphertext swapping between entries (AES-GCM AAD binds value to name)

What it does **not** protect against:

- `hushenv run -- env` prints that project's resolved secrets — scoping
  arrives with per-project grants in v1
- `hushenv get --force` from a non-interactive shell — pair it with an agent
  deny rule, e.g. `Bash(hushenv get*)` in Claude Code settings
- Malware running as your user with an unlocked keychain — same limit as any
  local secret manager

## Repo layout

```
packages/vault-core   engine: crypto, keychain, vault storage (name-agnostic)
apps/cli              the hushenv CLI: ref resolution, run, prompts
```

`vault-core` never imports anything env-file- or CLI-specific. Future
surfaces (tray UI, MCP broker) sit on the same engine.

## Contributing

PRs welcome — it's a small, readable codebase. Setup, tests, and how releases
work are in [CONTRIBUTING.md](CONTRIBUTING.md). Contributions are licensed
under Apache-2.0.

## Roadmap

v1: append-only audit log, per-project grants with strict mode (`import` —
migrate an existing `.env` — has shipped). v2: secret versions, rotation
warnings, tray UI.
