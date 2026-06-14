import { describe, expect, it } from 'vitest';
import { decryptValue, encryptValue, generateKey } from '../src/crypto';

describe('crypto', () => {
  it('round-trips a value', () => {
    const key = generateKey();
    const blob = encryptValue(key, 'DB_PASSWORD', 'hunter2');
    expect(decryptValue(key, 'DB_PASSWORD', blob)).toBe('hunter2');
  });

  it('produces a different ciphertext every time (fresh IV)', () => {
    const key = generateKey();
    const a = encryptValue(key, 'X', 'same');
    const b = encryptValue(key, 'X', 'same');
    expect(a.ct).not.toBe(b.ct);
    expect(a.iv).not.toBe(b.iv);
  });

  it('fails with the wrong key', () => {
    const blob = encryptValue(generateKey(), 'X', 'value');
    expect(() => decryptValue(generateKey(), 'X', blob)).toThrow(
      /wrong master key|tampered/,
    );
  });

  it('binds ciphertext to its name via AAD (no blob swapping)', () => {
    const key = generateKey();
    const blob = encryptValue(key, 'RESEND_KEY', 'rk_live_123');
    expect(() => decryptValue(key, 'DB_PASSWORD', blob)).toThrow();
  });

  it('detects a tampered auth tag', () => {
    const key = generateKey();
    const blob = encryptValue(key, 'X', 'value');
    const tag = Buffer.from(blob.tag, 'base64');
    tag[0] = tag[0]! ^ 0xff;
    expect(() =>
      decryptValue(key, 'X', { ...blob, tag: tag.toString('base64') }),
    ).toThrow();
  });
});
