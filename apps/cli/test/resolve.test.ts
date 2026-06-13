import { describe, expect, it } from 'vitest';
import { collectRefs, resolveRefs } from '../src/resolve';

const lookup = (name: string): string | undefined =>
  ({ DB_PASSWORD: 'hunter2', RESEND_KEY: 'rk_live_1' })[name];

describe('resolve', () => {
  it('resolves whole-value refs', () => {
    const { resolved, missing } = resolveRefs(
      { RESEND_KEY: '{hushenv.RESEND_KEY}' },
      lookup,
    );
    expect(resolved.RESEND_KEY).toBe('rk_live_1');
    expect(missing).toEqual([]);
  });

  it('resolves refs embedded inside larger strings', () => {
    const { resolved } = resolveRefs(
      { DATABASE_URL: 'postgres://app:{hushenv.DB_PASSWORD}@localhost:5432/db' },
      lookup,
    );
    expect(resolved.DATABASE_URL).toBe('postgres://app:hunter2@localhost:5432/db');
  });

  it('accepts mysm and mysmtool legacy aliases', () => {
    const { resolved } = resolveRefs(
      { A: '{mysm.DB_PASSWORD}', B: '{mysmtool.RESEND_KEY}' },
      lookup,
    );
    expect(resolved.A).toBe('hunter2');
    expect(resolved.B).toBe('rk_live_1');
  });

  it('collects missing names instead of throwing', () => {
    const { resolved, missing } = resolveRefs(
      { A: '{hushenv.NOPE}', B: '{hushenv.ALSO_NOPE}', C: 'plain' },
      lookup,
    );
    expect(missing.sort()).toEqual(['ALSO_NOPE', 'NOPE']);
    expect(resolved.A).toBe('{hushenv.NOPE}');
    expect(resolved.C).toBe('plain');
  });

  it('leaves non-ref values untouched', () => {
    const { resolved, used } = resolveRefs({ PLAIN: 'http://localhost:3000' }, lookup);
    expect(resolved.PLAIN).toBe('http://localhost:3000');
    expect(used).toEqual([]);
  });

  it('collectRefs dedupes across values', () => {
    const refs = collectRefs({
      A: '{hushenv.DB_PASSWORD}',
      B: 'x{hushenv.DB_PASSWORD}y {hushenv.RESEND_KEY}',
    });
    expect(refs.sort()).toEqual(['DB_PASSWORD', 'RESEND_KEY']);
  });
});
