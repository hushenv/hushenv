import fs from 'node:fs';
import path from 'node:path';

/**
 * Rewrites only the value portion of `KEY=...` lines whose key is in `refs`,
 * replacing it with the ref string. Everything else - comments, blank lines,
 * key order, `export ` prefixes, quoting style, and the file's EOL style - is
 * preserved byte-for-byte. dotenv `parse` is lossy (it drops all of that), so
 * this works on the raw text, not parse -> stringify.
 *
 * @param refs maps the env KEY (left-hand side in the file) to the ref string
 *   to substitute, e.g. `{hushenv.DB_PASSWORD}`.
 */
export function rewriteEnv(content: string, refs: Record<string, string>): string {
  // Split keeps the line terminators as odd-index parts, so re-joining is exact.
  const parts = content.split(/(\r\n|\n|\r)/);
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = rewriteLine(parts[i] as string, refs);
  }
  return parts.join('');
}

// Left-hand side: optional indent, optional `export `, a valid env key, then `=`.
const ASSIGN_RE = /^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/;
// Splits an RHS into (value)(optional ` # trailing comment`), respecting quotes.
const RHS_RE = /^(\s*(?:"[^"]*"|'[^']*'|[^#]*?))(\s+#.*)?$/;

function rewriteLine(line: string, refs: Record<string, string>): string {
  const m = ASSIGN_RE.exec(line);
  if (!m) return line;
  const [, lead, key, eq, rhs] = m as unknown as [string, string, string, string, string];
  const ref = refs[key];
  if (ref === undefined) return line;
  // Preserve a clean trailing inline comment if one is present (best-effort).
  const comment = RHS_RE.exec(rhs)?.[2] ?? '';
  return `${lead}${key}${eq}${ref}${comment}`;
}

/** Atomic write: temp file + rename, mode 0600 (mirrors vault saveVault). */
export function writeEnvFile(file: string, content: string): void {
  const dir = path.dirname(path.resolve(file));
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, content, { mode: 0o600 });
  fs.renameSync(tmp, file);
}
