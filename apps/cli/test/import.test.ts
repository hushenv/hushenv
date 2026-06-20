import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getSecretValue, initVault, listSecrets, setSecret } from '@hushenv/vault-core';
import { applyPrefix, classify, importCommand } from '../src/commands/import';
import { resolveRefs } from '../src/resolve';

let tmpHome: string;
let tmpDir: string;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hushenv-home-'));
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hushenv-proj-'));
  process.env.HUSHENV_HOME = tmpHome;
  process.env.HUSHENV_MASTER_KEY = randomBytes(32).toString('base64');
  initVault();
});

afterEach(() => {
  delete process.env.HUSHENV_HOME;
  delete process.env.HUSHENV_MASTER_KEY;
  process.exitCode = 0;
  fs.rmSync(tmpHome, { recursive: true, force: true });
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeEnv(content: string): string {
  const p = path.join(tmpDir, '.env');
  fs.writeFileSync(p, content);
  return p;
}

describe('classify', () => {
  it('auto-skips refs, empties, multiline, and invalid names', () => {
    const { candidates, skips } = classify({
      ALREADY: '{hushenv.ALREADY}',
      EMPTY: '',
      MULTI: 'line1\nline2',
      'BAD.NAME': 'x',
    });
    expect(candidates).toHaveLength(0);
    expect(skips).toEqual([
      { key: 'ALREADY', reason: 'ref' },
      { key: 'EMPTY', reason: 'empty' },
      { key: 'MULTI', reason: 'multiline' },
      { key: 'BAD.NAME', reason: 'invalid-name' },
    ]);
  });

  it('defaults: import on secret-y name, skip on config value, import on fallthrough', () => {
    const byKey = Object.fromEntries(
      classify({
        DB_PASSWORD: 'hunter2',
        PORT: '3000',
        DEBUG: 'true',
        NEXTAUTH_URL: 'http://localhost:3000',
        DATABASE_URL: 'postgres://app:pw@db.example.com/app',
      }).candidates.map((c) => [c.key, c.defaultImport]),
    );
    expect(byKey).toEqual({
      DB_PASSWORD: true,
      PORT: false,
      DEBUG: false,
      NEXTAUTH_URL: false,
      DATABASE_URL: true,
    });
  });

  it('applies the prefix to the final name and validates it', () => {
    expect(applyPrefix('DB', 'MYAPP')).toBe('MYAPP_DB');
    expect(applyPrefix('DB', 'MYAPP_')).toBe('MYAPP_DB');
    const ok = classify({ DB_PASSWORD: 'x' }, 'MYAPP');
    expect(ok.candidates[0]!.finalName).toBe('MYAPP_DB_PASSWORD');
    const bad = classify({ DB_PASSWORD: 'x' }, '1BAD');
    expect(bad.candidates).toHaveLength(0);
    expect(bad.skips).toEqual([{ key: 'DB_PASSWORD', reason: 'invalid-name' }]);
  });
});

describe('importCommand', () => {
  it('imports secret-y values, leaves config literal, preserves formatting', async () => {
    const file = writeEnv('# app\nDB_PASSWORD=hunter2\nPORT=3000\n');
    await importCommand({ file, all: true });

    expect(getSecretValue('DB_PASSWORD')).toBe('hunter2');
    expect(listSecrets().map((s) => s.name)).toEqual(['DB_PASSWORD']);
    expect(fs.readFileSync(file, 'utf8')).toBe(
      '# app\nDB_PASSWORD={hushenv.DB_PASSWORD}\nPORT=3000\n',
    );
  });

  it('--dry-run writes nothing to the vault or the file', async () => {
    const original = '# app\nDB_PASSWORD=hunter2\n';
    const file = writeEnv(original);
    await importCommand({ file, all: true, dryRun: true });

    expect(listSecrets()).toHaveLength(0);
    expect(fs.readFileSync(file, 'utf8')).toBe(original);
  });

  it('is idempotent: a second import is a no-op', async () => {
    const file = writeEnv('DB_PASSWORD=hunter2\n');
    await importCommand({ file, all: true });
    const afterFirst = fs.readFileSync(file, 'utf8');
    await importCommand({ file, all: true });
    expect(fs.readFileSync(file, 'utf8')).toBe(afterFirst);
    expect(listSecrets()).toHaveLength(1);
  });

  it('equal collision is a no-op but still rewrites the ref', async () => {
    setSecret('DB_PASSWORD', 'hunter2');
    const file = writeEnv('DB_PASSWORD=hunter2\n');
    await importCommand({ file, all: true });
    expect(getSecretValue('DB_PASSWORD')).toBe('hunter2');
    expect(fs.readFileSync(file, 'utf8')).toBe('DB_PASSWORD={hushenv.DB_PASSWORD}\n');
  });

  it('different collision: --force overwrites the vault value', async () => {
    setSecret('DB_PASSWORD', 'old');
    const file = writeEnv('DB_PASSWORD=new\n');
    await importCommand({ file, all: true, force: true });
    expect(getSecretValue('DB_PASSWORD')).toBe('new');
  });

  it('different collision: --skip-existing keeps the vault value but rewrites the ref', async () => {
    setSecret('DB_PASSWORD', 'old');
    const file = writeEnv('DB_PASSWORD=new\n');
    await importCommand({ file, all: true, skipExisting: true });
    expect(getSecretValue('DB_PASSWORD')).toBe('old');
    expect(fs.readFileSync(file, 'utf8')).toBe('DB_PASSWORD={hushenv.DB_PASSWORD}\n');
  });

  it('different collision with no flag: exit 1, nothing written', async () => {
    setSecret('DB_PASSWORD', 'old');
    const original = 'DB_PASSWORD=new\n';
    const file = writeEnv(original);
    await importCommand({ file, all: true });
    expect(process.exitCode).toBe(1);
    expect(getSecretValue('DB_PASSWORD')).toBe('old');
    expect(fs.readFileSync(file, 'utf8')).toBe(original);
  });

  it('round trips: resolveRefs over the rewritten file reproduces the original value', async () => {
    const file = writeEnv('API_TOKEN=s3cret-value\n');
    await importCommand({ file, all: true });
    const rewritten = await import('dotenv').then((d) =>
      d.parse(fs.readFileSync(file, 'utf8')),
    );
    const { resolved } = resolveRefs(rewritten, (n) => getSecretValue(n));
    expect(resolved.API_TOKEN).toBe('s3cret-value');
  });

  it('writes no plaintext to disk', async () => {
    const file = writeEnv('API_TOKEN=plaintext-marker\n');
    await importCommand({ file, all: true });
    expect(fs.readFileSync(path.join(tmpHome, 'vault.json'), 'utf8')).not.toContain(
      'plaintext-marker',
    );
    expect(fs.readFileSync(file, 'utf8')).not.toContain('plaintext-marker');
  });
});
