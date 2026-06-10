export interface SecretEntry {
  iv: string;
  ct: string;
  tag: string;
  createdAt: string;
  updatedAt: string;
}

export interface VaultFile {
  version: 1;
  secrets: Record<string, SecretEntry>;
  /** Reserved for v1 (per-project grants). */
  grants: Record<string, string[]>;
}
