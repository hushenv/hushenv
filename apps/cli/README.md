# hushenv

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
hushenv init                       # master key -> OS keychain, empty vault
hushenv set DB_PASSWORD            # hidden prompt
hushenv set RESEND_KEY --stdin     # or pipe it in
hushenv run -- pnpm dev            # resolves refs from ./.env, injects, runs
hushenv run -f .env.local -- pnpm dev
```

## Commands

| Command | What it does |
|---|---|
| `hushenv init` | Create the master key (keychain) and an empty vault |
| `hushenv set <name> [value]` | Store a secret. Hidden prompt by default; `--stdin` to pipe. Positional value is discouraged (shell history). |
| `hushenv get <name>` | Reveal a value. Requires an interactive TTY + confirmation; `--force` to bypass (use sparingly). |
| `hushenv ls` | List names and update dates. Never values. |
| `hushenv rm <name>` | Delete a secret |
| `hushenv run [-f file]... -- <cmd>` | Resolve refs and run the command with secrets injected |

Reference syntax: `{hushenv.NAME}` — whole-value or embedded inside a larger
string. `{mysm.NAME}` and `{mysmtool.NAME}` are accepted as legacy aliases.

## Semantics

- Multiple `-f` files: loaded in order, the **first** occurrence of a key wins.
- Existing `process.env` variables are **not** overridden by file values
  (dotenv convention).
- Missing refs **fail fast** before your app starts, with the exact
  `hushenv set` commands to fix it. Exit code 2.
- Exit codes: `0` ok · `1` error · `2` missing secret.

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

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm --filter hushenv dev -- --help   # run from source
```

To use your dev build globally: `cd apps/cli && pnpm link --global`
(run `pnpm setup` once first if pnpm complains about a global bin dir).

## Roadmap

v1: `import` (migrate an existing `.env`), append-only audit log,
per-project grants with strict mode. v2: secret versions, rotation warnings,
tray UI.
