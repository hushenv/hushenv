/**
 * Reference syntax: {hushenv.NAME}. The mysm/mysmtool prefixes are accepted
 * as legacy aliases.
 */
export const REF_RE = /\{(?:hushenv|mysm(?:tool)?)\.([A-Za-z_][A-Za-z0-9_]*)\}/g;

export interface ResolveResult {
  resolved: Record<string, string>;
  missing: string[];
  used: string[];
}

/** True if the value contains at least one {hushenv.NAME} ref. */
export function hasRef(value: string): boolean {
  return collectRefs({ value }).length > 0;
}

/** Collect every referenced secret name across all values. */
export function collectRefs(values: Record<string, string>): string[] {
  const names = new Set<string>();
  for (const value of Object.values(values)) {
    for (const match of value.matchAll(REF_RE)) {
      names.add(match[1] as string);
    }
  }
  return [...names];
}

/**
 * Substitutes refs (including refs embedded inside larger strings) using the
 * lookup. Missing names are collected, not thrown - the caller decides how
 * to fail.
 */
export function resolveRefs(
  values: Record<string, string>,
  lookup: (name: string) => string | undefined,
): ResolveResult {
  const missing = new Set<string>();
  const used = new Set<string>();
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    resolved[key] = value.replace(REF_RE, (whole, name: string) => {
      const secret = lookup(name);
      if (secret === undefined) {
        missing.add(name);
        return whole;
      }
      used.add(name);
      return secret;
    });
  }
  return { resolved, missing: [...missing], used: [...used] };
}
