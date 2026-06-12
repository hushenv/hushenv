# hushenv + Vite

First, the most important thing on this page:

## ⚠️ `VITE_*` variables are public

Anything prefixed `VITE_` is **compiled into your client bundle** and
shipped to every browser. hushenv cannot protect a value you put in public
JavaScript — nothing can. Use hushenv for the parts of a Vite project that
run on a machine you control: dev servers, SSR, API backends, build scripts.

```dotenv
VITE_API_BASE=https://api.example.com        # fine: public by design
VITE_API_KEY={hushenv.API_KEY}               # ❌ never — ends up in the bundle
API_KEY={hushenv.API_KEY}                    # ✅ server/build-time only
```

## 1. Store your secrets

```bash
hushenv set API_KEY
hushenv set DATABASE_PASSWORD
```

## 2. Put refs in `.env`

```dotenv
VITE_API_BASE=http://localhost:8787
DATABASE_URL=postgres://app:{hushenv.DATABASE_PASSWORD}@localhost:5432/app
API_KEY={hushenv.API_KEY}
```

## 3. Run through hushenv

```bash
npm i -D hushenv
```

```json
"scripts": {
  "dev": "hushenv run -- vite",
  "build": "hushenv run -- vite build",
  "preview": "hushenv run -- vite preview"
}
```

Where the secrets are actually used:

- **`vite.config.ts`** runs in Node — `process.env.API_KEY` is the real
  value there (proxy configs, build-time fetches).
- **SSR / API server** (Nitro, Express sidecar, Cloudflare Workers dev):
  wrap that process too — `hushenv run -- node server.js`.
- **Client code** only ever sees `import.meta.env.VITE_*` — which is why
  secrets must not be `VITE_`-prefixed.

## Why it works

Vite's `loadEnv` reads `.env` files for `import.meta.env`, but the Node
process that runs `vite.config.ts` and your SSR code sees `process.env` —
which hushenv has already populated with real values before Vite starts.
Non-`VITE_` entries in `.env` files are never exposed to the client.

## Gotchas

- Mode-specific files (`.env.development`, `.env.production`): pass the same
  file to hushenv — `hushenv run -f .env.production -- vite build`.
- A missing secret fails with exit code 2 before Vite starts, listing the
  exact `hushenv set` commands to run.
