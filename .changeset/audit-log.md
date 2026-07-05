---
"hushenv": minor
"@hushenv/vault-core": minor
---

Add an append-only **audit log**. Every action
(`init`/`set`/`get`/`rm`/`mv`/`import`/`run`) is appended to
`~/.hushenv/audit.log`, recording names and metadata only — never secret values.
Entries are chained with an HMAC-SHA256 keyed by the master key, so they can't be
forged or edited without the key. View it with `hushenv log` and check integrity
with `hushenv log --verify` (`--tail <n>`, `--json` also supported).

`vault-core` gains a generic `appendAudit` / `readAudit` / `verifyAudit` log
primitive (name-agnostic; the CLI supplies the event vocabulary) and
`auditPath()` / `auditLockPath()` helpers.
