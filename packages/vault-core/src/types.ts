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
  /** Per-project allow-lists: canonical project path -> granted secret names. */
  grants: Record<string, string[]>;
  /** Optional, additive settings. Absent on vaults created before v0.5. */
  settings?: {
    /** When true, projects with no grants entry are blocked at `run` time. */
    strict?: boolean;
  };
}
