# hushenv + Rust

> hushenv ships via npm, so you need Node ≥ 20 installed to *install* it —
> your app stays pure Rust. `npm i -g hushenv && hushenv init` once.

## 1. Store your secrets

```bash
hushenv set DATABASE_PASSWORD
hushenv set API_TOKEN --stdin
```

## 2. Put refs in `.env`

```dotenv
RUST_LOG=debug
DATABASE_URL=postgres://app:{hushenv.DATABASE_PASSWORD}@localhost:5432/app
API_TOKEN={hushenv.API_TOKEN}
```

## 3. Run through hushenv

```bash
hushenv run -- cargo run
hushenv run -- cargo test
hushenv run -- cargo watch -x run
```

Your Rust code reads the environment as usual:

```rust
let token = std::env::var("API_TOKEN")?;   // real value, ref already resolved
```

## Why it works

`std::env::var` sees exactly what `hushenv run` injected. If you use
[dotenvy](https://github.com/allan2/dotenvy), its `dotenvy::dotenv()`
**does not override variables that already exist** in the environment —
only the explicit `dotenv_override()` / `*_override` variants do. So the
injected real values win over the `{hushenv.X}` strings in the file.

Note for sqlx users: `sqlx` macros read `DATABASE_URL` at **compile time** —
wrap the build too: `hushenv run -- cargo build` (or `cargo sqlx prepare`).

## Gotchas

- Don't switch to `dotenv_override()` — it inverts the precedence and the
  literal ref strings would win.
- Compiled binaries work identically: `hushenv run -- ./target/release/app`.
- Production: no OS keychain in containers — set `HUSHENV_MASTER_KEY`
  (32 bytes, base64), or skip hushenv there and use your platform's secret
  injection.
