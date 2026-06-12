# hushenv + NestJS

## 1. Store your secrets

```bash
hushenv set DATABASE_PASSWORD     # hidden prompt
hushenv set JWT_SECRET
```

## 2. Put refs in `.env`

```dotenv
PORT=3000
DATABASE_URL=postgres://app:{hushenv.DATABASE_PASSWORD}@localhost:5432/app
JWT_SECRET={hushenv.JWT_SECRET}
```

## 3. Run through hushenv

Ad hoc:

```bash
hushenv run -- pnpm start:dev
```

Better — add hushenv as a dev dependency and bake it into the scripts, so
every teammate gets it from `node_modules/.bin` with no global install:

```bash
pnpm add -D hushenv
```

```json
"scripts": {
  "dev": "hushenv run -- nest start --watch",
  "typeorm": "hushenv run -- typeorm-ts-node-commonjs -d src/data-source.ts",
  "prisma:migrate": "hushenv run -- prisma migrate dev",
  "test:e2e": "hushenv run -- jest --config ./test/jest-e2e.json"
}
```

Each developer still runs `hushenv init` and `hushenv set ...` once on their
own machine — that's the point: secrets are per-machine, refs are shared.

## Why it works

`@nestjs/config` loads `.env` via dotenv, and dotenv **never overwrites
variables that already exist in `process.env`**. `hushenv run` injects the
resolved values before Nest boots, so `ConfigService.get('JWT_SECRET')`
returns the real value and the `{hushenv.X}` ref strings in the file are
never used. Reading `process.env.X` directly works the same way. No NestJS
code changes.

`nest start --watch` restarts happen inside the child process, so the
injected environment survives recompiles.

## Gotchas

- **Custom env file paths**: if you use
  `ConfigModule.forRoot({ envFilePath: '.env.development' })`, point hushenv
  at the same file: `hushenv run -f .env.development -- nest start --watch`.
- **Validation schemas** (Joi / class-validator): they validate the injected
  values — good — but a secret you forgot to migrate arrives as the literal
  string `{hushenv.MY_SECRET}` and may pass a naive `Joi.string()`. hushenv's
  fail-fast on missing refs (exit code 2) catches the common case before Nest
  even starts.
- Wrap *every* script that reads the env (TypeORM/Prisma CLIs, e2e tests),
  not just `dev` — anything run without `hushenv run` sees raw refs.
