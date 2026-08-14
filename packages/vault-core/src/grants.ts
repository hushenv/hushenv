import fs from 'node:fs';
import path from 'node:path';
import { assertValidName } from './vault.js';
import { loadVault, saveVault } from './vault.js';

/**
 * Canonical project identity: resolve symlinks and on-disk casing (Windows) so
 * the same directory always maps to the same grants key. Falls back to an
 * absolute path when the directory doesn't exist yet.
 */
export function canonicalProject(dir: string): string {
  try {
    return fs.realpathSync(dir);
  } catch {
    return path.resolve(dir);
  }
}

/** Grant secret names to a project (exact directory). Additive, de-duped, sorted. */
export function grantProject(project: string, names: string[]): void {
  for (const name of names) assertValidName(name);
  const key = canonicalProject(project);
  const vault = loadVault();
  const merged = new Set([...(vault.grants[key] ?? []), ...names]);
  vault.grants[key] = [...merged].sort();
  saveVault(vault);
}

/**
 * Revoke names from a project. When the last name is removed the entry is
 * deleted entirely, so the project returns to unrestricted (subject to strict).
 */
export function revokeProject(project: string, names: string[]): void {
  const key = canonicalProject(project);
  const vault = loadVault();
  const current = vault.grants[key];
  if (!current) return;
  const remaining = current.filter((n) => !names.includes(n));
  if (remaining.length > 0) {
    vault.grants[key] = remaining;
  } else {
    delete vault.grants[key];
  }
  saveVault(vault);
}

export function listGrants(): Record<string, string[]> {
  return loadVault().grants;
}

/** Exact-directory match: is `name` granted to this project? */
export function isGranted(project: string, name: string): boolean {
  return (loadVault().grants[canonicalProject(project)] ?? []).includes(name);
}

export function getStrict(): boolean {
  return loadVault().settings?.strict ?? false;
}

export function setStrict(on: boolean): void {
  const vault = loadVault();
  vault.settings = { ...vault.settings, strict: on };
  saveVault(vault);
}

/**
 * Enforcement core (one vault load): the referenced names NOT allowed for this
 * project.
 *   - project has a grants entry -> denied = names outside the allow-list
 *   - project has no entry        -> denied = strict ? all names : none
 */
export function deniedNames(project: string, names: string[]): string[] {
  const vault = loadVault();
  const entry = vault.grants[canonicalProject(project)];
  if (entry !== undefined) {
    return names.filter((n) => !entry.includes(n));
  }
  return vault.settings?.strict ? [...names] : [];
}
