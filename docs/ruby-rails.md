# hushenv + Ruby / Rails

> hushenv ships via npm, so you need Node ≥ 20 installed to *install* it —
> your app stays pure Ruby. `npm i -g hushenv && hushenv init` once.

## 1. Store your secrets

```bash
hushenv set DATABASE_PASSWORD
hushenv set RAILS_MASTER_KEY --stdin
```

## 2. Put refs in `.env`

```dotenv
DATABASE_URL=postgres://app:{hushenv.DATABASE_PASSWORD}@localhost:5432/app
RAILS_MASTER_KEY={hushenv.RAILS_MASTER_KEY}
```

## 3. Run through hushenv

```bash
hushenv run -- rails server
hushenv run -- rails db:migrate
hushenv run -- bundle exec sidekiq
```

Or wrap it once in `bin/dev` (Rails 7+ convention):

```bash
#!/usr/bin/env sh
exec hushenv run -- foreman start -f Procfile.dev "$@"
```

## Why it works

dotenv-rails **does not overwrite existing `ENV` variables by default** —
"dotenv assumes the deployment environment has more knowledge about
configuration than the application does." `hushenv run` injects real values
before Ruby starts, so `ENV["DATABASE_PASSWORD"]` is the real secret and the
`{hushenv.X}` ref strings in the file go unused.

This composes nicely with Rails credentials too: keep using
`config/credentials.yml.enc` if you like it, and use hushenv for the
`RAILS_MASTER_KEY` itself — the one secret that scheme can't protect.

## Gotchas

- Don't use `Dotenv.overload` (or `overwrite: true`) anywhere — that
  inverts the precedence and the literal ref strings would win.
- Spring/bootsnap preloaders cache the environment of the process that
  started them — restart `spring stop` after changing secrets.
- Production: no OS keychain — set `HUSHENV_MASTER_KEY` (32 bytes, base64)
  or use your platform's env injection instead of hushenv.
