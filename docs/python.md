# hushenv + Python (FastAPI / Django / Flask)

> hushenv ships via npm, so you need Node ≥ 20 installed to *install* it —
> your app stays pure Python. `npm i -g hushenv && hushenv init` once.

## 1. Store your secrets

```bash
hushenv set DATABASE_PASSWORD
hushenv set DJANGO_SECRET_KEY
```

## 2. Put refs in `.env`

```dotenv
DEBUG=true
DATABASE_URL=postgres://app:{hushenv.DATABASE_PASSWORD}@localhost:5432/app
SECRET_KEY={hushenv.DJANGO_SECRET_KEY}
```

## 3. Run through hushenv

```bash
hushenv run -- uvicorn main:app --reload          # FastAPI
hushenv run -- python manage.py runserver         # Django
hushenv run -- flask run --debug                  # Flask
hushenv run -- python manage.py migrate           # one-off commands too
```

Bake it into your task runner so nobody forgets — e.g. a `Makefile`:

```makefile
dev:
	hushenv run -- uvicorn main:app --reload

migrate:
	hushenv run -- python manage.py migrate
```

Your Python code doesn't change:

```python
import os
secret = os.environ["SECRET_KEY"]          # real value

# or with pydantic-settings / python-dotenv — also fine, see below
```

## Why it works

python-dotenv's `load_dotenv()` defaults to `override=False` — it **won't
replace variables that already exist in the process environment**. hushenv
injects the real values before Python starts, so `os.environ`,
pydantic-settings, and `load_dotenv()` all see real secrets while the
`{hushenv.X}` strings in the file go unused. Plain config values in the
same `.env` load normally either way.

## Gotchas

- If somewhere you call `load_dotenv(override=True)`, the literal ref
  strings *would* win — drop the `override` flag (it's rarely what you want
  in dev anyway).
- Virtualenvs don't matter here: env vars pass through `hushenv run` into
  whatever interpreter the command resolves to.
- Production (Docker, systemd): no OS keychain — set `HUSHENV_MASTER_KEY`
  (32 bytes, base64) in the unit/container env, or skip hushenv in prod and
  inject real env vars from your platform.
