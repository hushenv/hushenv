# hushenv + Next.js

## 1. Store your secrets

```bash
hushenv set DATABASE_PASSWORD
hushenv set NEXTAUTH_SECRET
hushenv set RESEND_KEY --stdin
```

## 2. Put refs in `.env`

```dotenv
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET={hushenv.NEXTAUTH_SECRET}
DATABASE_URL=postgres://app:{hushenv.DATABASE_PASSWORD}@localhost:5432/app
RESEND_KEY={hushenv.RESEND_KEY}
```

## 3. Run through hushenv

```bash
npm i -D hushenv
```

```json
"scripts": {
  "dev": "hushenv run -- next dev",
  "build": "hushenv run -- next build",
  "start": "hushenv run -- next start"
}
```

`next build` needs the wrap too if secrets are read at build time (e.g.
database access during static generation).

## Why it works

Next.js loads `.env*` files itself (via `@next/env`), but **values already
present in the process environment take priority over `.env` file values**.
`hushenv run` sets the real values before Next starts, so server code sees
real secrets and the `{hushenv.X}` strings in the file are ignored.

## ⚠️ The `NEXT_PUBLIC_` rule still applies

Anything named `NEXT_PUBLIC_*` is **inlined into the client JavaScript
bundle at build time** and shipped to every browser. hushenv cannot protect
a secret you compile into public code — nothing can.

```dotenv
NEXT_PUBLIC_ANALYTICS_ID=abc123        # fine: public by design
NEXT_PUBLIC_API_KEY={hushenv.API_KEY}  # ❌ never do this — it ends up in the bundle
API_KEY={hushenv.API_KEY}              # ✅ server-only
```

Use hushenv for server-side env vars; treat `NEXT_PUBLIC_*` as public
configuration, never secrets.

## Gotchas

- `.env.local`, `.env.development` etc. all work — point hushenv at the same
  files Next reads: `hushenv run -f .env.local -f .env -- next dev` (first
  occurrence of a key wins).
- Vercel/production deploys don't run hushenv — set real env vars in your
  hosting platform's dashboard; hushenv solves the *local dev* problem.
