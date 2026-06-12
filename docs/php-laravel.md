# hushenv + PHP / Laravel

> hushenv ships via npm, so you need Node ≥ 20 installed to *install* it —
> your app stays pure PHP. `npm i -g hushenv && hushenv init` once.

## 1. Store your secrets

```bash
hushenv set DB_PASSWORD
hushenv set APP_KEY --stdin        # e.g. pipe from php artisan key:generate --show
```

## 2. Put refs in `.env`

```dotenv
APP_ENV=local
APP_KEY={hushenv.APP_KEY}
DB_PASSWORD={hushenv.DB_PASSWORD}
```

## 3. Run through hushenv

```bash
hushenv run -- php artisan serve
hushenv run -- php artisan migrate
hushenv run -- php artisan queue:work
```

Or via composer scripts:

```json
"scripts": {
  "dev": "hushenv run -- php artisan serve"
}
```

```bash
composer dev
```

## Why it works

Laravel loads `.env` with phpdotenv's `Dotenv::createImmutable()` —
*immutable* meaning it **never overwrites variables that already exist** in
the real environment. `hushenv run` sets the real values before PHP starts,
so `env('DB_PASSWORD')` and `config()` see real secrets while the
`{hushenv.X}` strings in the file are ignored.

## Gotchas

- **`php artisan config:cache`** bakes resolved config to disk — run it
  through hushenv too (`hushenv run -- php artisan config:cache`), and be
  aware the cached file then contains plaintext values; that's a Laravel
  caching property, not a hushenv one. Avoid config caching in dev.
- Vite-bundled frontend assets in Laravel apps: `VITE_*` vars are public —
  see [docs/vite.md](vite.md).
- Production (Forge, Docker): no OS keychain — set `HUSHENV_MASTER_KEY`
  (32 bytes, base64), or skip hushenv in prod and let your platform inject
  real env vars.
