import { describe, expect, it } from 'vitest';
import { normalizeStdinValue } from '../src/commands/set';

const BOM = String.fromCharCode(0xfeff);

describe('normalizeStdinValue', () => {
  it('strips a leading BOM (PowerShell 5.1 pipe artifact)', () => {
    expect(normalizeStdinValue(`${BOM}hunter2`)).toBe('hunter2');
  });

  it('strips a single trailing newline (LF and CRLF)', () => {
    expect(normalizeStdinValue('hunter2\n')).toBe('hunter2');
    expect(normalizeStdinValue('hunter2\r\n')).toBe('hunter2');
  });

  it('strips BOM and trailing newline together', () => {
    expect(normalizeStdinValue(`${BOM}hunter2\r\n`)).toBe('hunter2');
  });

  it('leaves a BOM elsewhere in the value untouched', () => {
    expect(normalizeStdinValue(`pass${BOM}word`)).toBe(`pass${BOM}word`);
  });

  it('leaves an already-clean value untouched', () => {
    expect(normalizeStdinValue('hunter2')).toBe('hunter2');
  });
});
