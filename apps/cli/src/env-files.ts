import fs from 'node:fs';
import { parse } from 'dotenv';

/** Loads env files in order; the FIRST occurrence of a key wins. */
export function loadEnvFiles(files: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of files) {
    if (!fs.existsSync(file)) {
      throw new Error(`Env file not found: ${file}`);
    }
    const parsed = parse(fs.readFileSync(file, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (!(key in out)) out[key] = value;
    }
  }
  return out;
}
