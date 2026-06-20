import { describe, expect, it } from 'vitest';
import { rewriteEnv } from '../src/env-rewrite';

describe('rewriteEnv', () => {
  it('replaces only the value of targeted keys', () => {
    const input = 'A=secret\nB=keep\n';
    expect(rewriteEnv(input, { A: '{hushenv.A}' })).toBe('A={hushenv.A}\nB=keep\n');
  });

  it('preserves comments, blank lines, order, and the export prefix', () => {
    const input = '# header\n\nexport A=secret\nB=plain\n';
    expect(rewriteEnv(input, { A: '{hushenv.A}' })).toBe(
      '# header\n\nexport A={hushenv.A}\nB=plain\n',
    );
  });

  it('preserves a clean inline comment on a rewritten line', () => {
    expect(rewriteEnv('A=secret # prod key\n', { A: '{hushenv.A}' })).toBe(
      'A={hushenv.A} # prod key\n',
    );
  });

  it('preserves CRLF terminators and a missing final newline', () => {
    expect(rewriteEnv('A=secret\r\nB=last', { A: '{hushenv.A}', B: '{hushenv.B}' })).toBe(
      'A={hushenv.A}\r\nB={hushenv.B}',
    );
  });

  it('renames the secret independently of the env key', () => {
    expect(rewriteEnv('RESEND=x\n', { RESEND: '{hushenv.MYAPP_RESEND}' })).toBe(
      'RESEND={hushenv.MYAPP_RESEND}\n',
    );
  });

  it('leaves the file untouched when no keys are targeted', () => {
    expect(rewriteEnv('A=x\nB=y\n', {})).toBe('A=x\nB=y\n');
  });
});
