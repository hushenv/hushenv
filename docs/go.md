# hushenv + Go

> hushenv ships via npm, so you need Node ≥ 20 installed to *install* it —
> your app stays pure Go. `npm i -g hushenv && hushenv init` once.

## 1. Store your secrets

```bash
hushenv set DATABASE_PASSWORD
hushenv set STRIPE_KEY --stdin
```

## 2. Put refs in `.env`

```dotenv
PORT=8080
DATABASE_URL=postgres://app:{hushenv.DATABASE_PASSWORD}@localhost:5432/app
STRIPE_KEY={hushenv.STRIPE_KEY}
```

## 3. Run through hushenv

```bash
hushenv run -- go run .
hushenv run -- go test ./...
hushenv run -- air                 # live-reload tools work the same way
```

Or in a `Makefile`:

```makefile
dev:
	hushenv run -- go run .

test:
	hushenv run -- go test ./...
```

Your Go code reads the environment as usual:

```go
dsn := os.Getenv("DATABASE_URL")   // real value, ref already resolved
```

## Why it works

Go has no built-in `.env` loading — most projects read `os.Getenv` directly,
which sees exactly what `hushenv run` injected. If you use
[godotenv](https://github.com/joho/godotenv), its `godotenv.Load()` **does
not override variables that already exist** in the environment, so the
injected real values win over the ref strings in the file. (Only
`godotenv.Overload()` would force file values — don't use it with hushenv.)

## Gotchas

- Compiled binaries too: `hushenv run -- ./bin/server` works the same as
  `go run` — it's just env injection around a child process.
- A missing secret exits with code 2 *before* your program starts and
  prints the `hushenv set` commands to fix it.
- Production: no OS keychain in containers — set `HUSHENV_MASTER_KEY`
  (32 bytes, base64), or skip hushenv there and use your platform's secret
  injection.
