import { type AuditInput, appendAudit } from '@hushenv/vault-core';

/**
 * Fail-open audit: a locked or unwritable audit log must never abort the actual
 * command (especially `hushenv run`). On failure we warn to stderr and continue.
 */
export function recordAudit(event: string, input?: AuditInput): void {
  try {
    appendAudit(event, input);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`! audit log not written for "${event}": ${msg}`);
  }
}
