import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  canonicalProject,
  deniedNames,
  getStrict,
  grantProject,
  initVault,
  isGranted,
  listGrants,
  revokeProject,
  setStrict,
} from '../src/index';

let tmpHome: string;
let projA: string;
let projB: string;

const mkdir = (p: string) => fs.mkdtempSync(path.join(os.tmpdir(), p));

beforeEach(() => {
  tmpHome = mkdir('hushenv-grants-home-');
  process.env.HUSHENV_HOME = tmpHome;
  process.env.HUSHENV_MASTER_KEY = randomBytes(32).toString('base64');
  initVault();
  projA = mkdir('hushenv-projA-');
  projB = mkdir('hushenv-projB-');
});

afterEach(() => {
  delete process.env.HUSHENV_HOME;
  delete process.env.HUSHENV_MASTER_KEY;
  for (const d of [tmpHome, projA, projB]) fs.rmSync(d, { recursive: true, force: true });
});

describe('grants', () => {
  it('are exact-directory and stored additive + sorted', () => {
    grantProject(projA, ['B_KEY']);
    grantProject(projA, ['A_KEY']);
    expect(listGrants()[canonicalProject(projA)]).toEqual(['A_KEY', 'B_KEY']);
    expect(isGranted(projA, 'A_KEY')).toBe(true);

    const sub = path.join(projA, 'sub');
    fs.mkdirSync(sub);
    expect(isGranted(sub, 'A_KEY')).toBe(false); // exact match, no walk-up
  });

  it('revoke removes names; revoking the last deletes the entry (unrestricted again)', () => {
    grantProject(projA, ['A', 'B']);
    revokeProject(projA, ['A']);
    expect(listGrants()[canonicalProject(projA)]).toEqual(['B']);
    revokeProject(projA, ['B']);
    expect(Object.hasOwn(listGrants(), canonicalProject(projA))).toBe(false);
  });

  it('deniedNames: a scoped project blocks ungranted, allows granted', () => {
    grantProject(projA, ['A']);
    expect(deniedNames(projA, ['A', 'B'])).toEqual(['B']);
    expect(deniedNames(projA, ['A'])).toEqual([]);
  });

  it('deniedNames: a project with no entry follows the global strict setting', () => {
    expect(deniedNames(projB, ['A', 'B'])).toEqual([]); // strict off (default)
    setStrict(true);
    expect(deniedNames(projB, ['A', 'B'])).toEqual(['A', 'B']); // strict on
  });

  it('strict get/set round-trips', () => {
    expect(getStrict()).toBe(false);
    setStrict(true);
    expect(getStrict()).toBe(true);
    setStrict(false);
    expect(getStrict()).toBe(false);
  });

  it('rejects invalid grant names', () => {
    expect(() => grantProject(projA, ['1BAD'])).toThrow(/Invalid secret name/);
  });
});
