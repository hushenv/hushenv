# hushenv + Express (and plain Node)

## 1. Store your secrets

```bash
hushenv set DATABASE_PASSWORD
hushenv set SESSION_SECRET
```

## 2. Put refs in `.env`

```dotenv
PORT=3000
DATABASE_URL=postgres://app:{hushenv.DATABASE_PASSWORD}@localhost:5432/app
SESSION_SECRET={hushenv.SESSION_SECRET}
```

## 3. Run through hushenv

```bash
npm i -D hushenv
```

```json
"scripts": {
  "dev": "hushenv run -- nodemon src/server.js",
  "start": "hushenv run -- node src/server.js"
}
```

Your app code doesn't change at all:

```js
import 'dotenv/config';            // keep it — harmless, see below

const sessionSecret = process.env.SESSION_SECRET;  // real value
```

## Why it works

dotenv's contract: it **never overwrites a variable that already exists in
`process.env`**. `hushenv run` resolves `{hushenv.X}` refs from `./.env`
(or files you pass with `-f`) and injects real values before Node starts —
so by the time `dotenv/config` runs, the variables exist and dotenv skips
them. If some entries in your `.env` are plain values (ports, URLs), either
loader delivers those identically.

You can even drop dotenv entirely — `hushenv run` already loads the file —
but keeping it means teammates who haven't adopted hushenv yet aren't broken.

## Gotchas

- One-off scripts need the wrap too: `hushenv run -- node scripts/seed.js`.
- A forgotten secret fails fast **before** your server starts, with exit
  code 2 and the exact `hushenv set` commands to fix it — watch for that in
  CI logs.
- In production/containers there's usually no OS keychain — set
  `HUSHENV_MASTER_KEY` (32 bytes, base64) in the environment, or skip
  hushenv there and inject real env vars from your platform.
