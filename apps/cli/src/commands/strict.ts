import { getStrict, setStrict } from '@hushenv/vault-core';
import { recordAudit } from '../audit.js';

export function strictCommand(state: string | undefined): void {
  if (state === undefined) {
    console.log(`strict mode is ${getStrict() ? 'on' : 'off'}.`);
    return;
  }
  if (state !== 'on' && state !== 'off') {
    throw new Error('Usage: hushenv strict [on|off]');
  }
  const on = state === 'on';
  setStrict(on);
  recordAudit('strict', { meta: { on } });
  console.log(`* strict mode ${on ? 'on' : 'off'}.`);
}
