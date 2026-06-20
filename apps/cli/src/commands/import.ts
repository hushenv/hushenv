import fs from 'node:fs';
import path from 'node:path';
import { checkbox, input, select } from '@inquirer/prompts';
import { parse } from 'dotenv';
import {
  getSecretValue,
  isValidName,
  listSecrets,
  setSecrets,
} from '@hushenv/vault-core';
import { rewriteEnv, writeEnvFile } from '../env-rewrite.js';
import { hasRef } from '../resolve.js';

export interface ImportOptions {
  file?: string;
  all?: boolean;
  dryRun?: boolean;
  force?: boolean;
  skipExisting?: boolean;
  prefix?: string;
}

type SkipReason = 'ref' | 'empty' | 'multiline' | 'invalid-name';

export interface Candidate {
  /** The env key as it appears on the left-hand side in the file. */
  key: string;
  /** The vault name (key after prefixing). Refs are written for this name. */
  finalName: string;
  value: string;
  /** Pre-selected for import in interactive triage / taken under --all. */
  defaultImport: boolean;
}

export interface Skip {
  key: string;
  reason: SkipReason;
}

export interface ClassifyResult {
  candidates: Candidate[];
  skips: Skip[];
}

// A value like this looks like config, not a secret: booleans, bare numbers,
// or a localhost URL (e.g. NEXTAUTH_URL=http://localhost:3000).
const CONFIG_VALUE_RE =
  /^(?:true|false|\d+(?:\.\d+)?|https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(?:\/.*)?)$/i;

/** Prefix every imported name; a `_` separator is added if absent. */
export function applyPrefix(name: string, prefix?: string): string {
  if (!prefix) return name;
  const p = prefix.endsWith('_') ? prefix : `${prefix}_`;
  return `${p}${name}`;
}

/**
 * Default selection: skip values that clearly look like config (booleans, bare
 * numbers, localhost URLs); import everything else. Fail safe - leaving a real
 * secret in plaintext is the worse outcome, so the fallthrough is "import".
 */
function defaultImportFor(value: string): boolean {
  return !CONFIG_VALUE_RE.test(value);
}

/** Pure classification of parsed env entries - the unit-testable core. */
export function classify(
  parsed: Record<string, string>,
  prefix?: string,
): ClassifyResult {
  const candidates: Candidate[] = [];
  const skips: Skip[] = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (hasRef(value)) {
      skips.push({ key, reason: 'ref' });
    } else if (value.length === 0) {
      skips.push({ key, reason: 'empty' });
    } else if (value.includes('\n')) {
      skips.push({ key, reason: 'multiline' });
    } else {
      const finalName = applyPrefix(key, prefix);
      if (!isValidName(finalName)) {
        skips.push({ key, reason: 'invalid-name' });
      } else {
        candidates.push({
          key,
          finalName,
          value,
          defaultImport: defaultImportFor(value),
        });
      }
    }
  }
  return { candidates, skips };
}

type ActionKind = 'write' | 'overwrite' | 'equal' | 'keep';
interface Action extends Candidate {
  kind: ActionKind;
}

/** Suggest a project-namespaced name for the rename-on-conflict flow. */
function suggestRenamedName(name: string): string {
  const dir = path
    .basename(process.cwd())
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_');
  const head = /^[A-Z_]/.test(dir) ? dir : `P_${dir}`;
  return `${head}_${name}`;
}

export async function importCommand(opts: ImportOptions): Promise<void> {
  const file = opts.file ?? '.env';
  if (!fs.existsSync(file)) {
    throw new Error(`Env file not found: ${file}`);
  }
  const content = fs.readFileSync(file, 'utf8');
  const { candidates, skips } = classify(parse(content), opts.prefix);

  warnSkips(skips);

  // Selection: interactive checkbox, or heuristic defaults when --all / no TTY.
  const interactive = !opts.all && Boolean(process.stdin.isTTY && process.stdout.isTTY);
  let selected: Candidate[];
  if (interactive && candidates.length > 0) {
    selected = await checkbox({
      message: `Select secrets to import from ${file}:`,
      choices: candidates.map((c) => ({
        name: c.finalName,
        value: c,
        checked: c.defaultImport,
      })),
    });
  } else {
    selected = candidates.filter((c) => c.defaultImport);
  }

  const existing = new Set(listSecrets().map((s) => s.name));
  const actions: Action[] = [];
  const conflicts: Candidate[] = [];
  for (const c of selected) {
    if (!existing.has(c.finalName)) {
      actions.push({ ...c, kind: 'write' });
    } else if (getSecretValue(c.finalName) === c.value) {
      actions.push({ ...c, kind: 'equal' });
    } else {
      conflicts.push(c);
    }
  }

  if (conflicts.length > 0) {
    if (interactive) {
      for (const c of conflicts) {
        actions.push(await resolveConflictInteractively(c));
      }
    } else if (opts.force) {
      for (const c of conflicts) actions.push({ ...c, kind: 'overwrite' });
    } else if (opts.skipExisting) {
      for (const c of conflicts) actions.push({ ...c, kind: 'keep' });
    } else {
      console.error(
        `x ${conflicts.length} secret(s) already in the vault with a different value:`,
      );
      for (const c of conflicts) console.error(`    ${c.finalName}`);
      console.error(
        '\n  Re-run with --force (overwrite) or --skip-existing (keep vault value).',
      );
      process.exitCode = 1;
      return;
    }
  }

  const writeMap: Record<string, string> = {};
  const refs: Record<string, string> = {};
  let importedCount = 0;
  let alreadyCount = 0;
  for (const a of actions) {
    if (a.kind === 'write' || a.kind === 'overwrite') {
      writeMap[a.finalName] = a.value;
      importedCount++;
    } else {
      alreadyCount++;
    }
    refs[a.key] = `{hushenv.${a.finalName}}`;
  }
  const skippedCount = candidates.length - selected.length;

  if (opts.dryRun) {
    printPlan(file, actions, candidates, selected, skips);
    return;
  }

  if (Object.keys(refs).length === 0) {
    console.log('Nothing to import. No changes made.');
    return;
  }

  // Vault is written and round-trip verified BEFORE the file is touched, so a
  // mid-failure never leaves a rewritten .env with the plaintext already gone.
  if (Object.keys(writeMap).length > 0) {
    setSecrets(writeMap);
    for (const [name, value] of Object.entries(writeMap)) {
      if (getSecretValue(name) !== value) {
        throw new Error(
          `Round-trip verification failed for "${name}"; ${file} left unchanged.`,
        );
      }
    }
  }
  writeEnvFile(file, rewriteEnv(content, refs));

  console.log(
    `* Imported ${importedCount} secret(s), ${alreadyCount} already in vault, ` +
      `rewrote ${file} (${Object.keys(refs).length} ref(s)), skipped ${skippedCount} plain value(s).`,
  );
  console.error(
    `! If ${file} was ever committed, the old plaintext values are in your git history - rotate them.`,
  );
}

async function resolveConflictInteractively(c: Candidate): Promise<Action> {
  const choice = await select({
    message: `"${c.finalName}" is already in the vault with a different value.`,
    choices: [
      { name: 'Overwrite the vault value', value: 'overwrite' },
      { name: 'Keep the vault value (rewrite ref only)', value: 'keep' },
      { name: 'Import under a new name', value: 'rename' },
    ] as const,
  });
  if (choice === 'overwrite') return { ...c, kind: 'overwrite' };
  if (choice === 'keep') return { ...c, kind: 'keep' };
  const newName = await input({
    message: 'New secret name:',
    default: suggestRenamedName(c.finalName),
    validate: (v) =>
      isValidName(v)
        ? true
        : 'Use letters, digits and underscores, not starting with a digit.',
  });
  return { ...c, finalName: newName, kind: 'write' };
}

function warnSkips(skips: Skip[]): void {
  for (const s of skips) {
    if (s.reason === 'multiline') {
      console.error(
        `! Skipping ${s.key}: multiline values are not rewritten in this version.`,
      );
    } else if (s.reason === 'invalid-name') {
      console.error(
        `! Skipping ${s.key}: not a valid secret name (letters, digits, underscores).`,
      );
    }
  }
}

function printPlan(
  file: string,
  actions: Action[],
  candidates: Candidate[],
  selected: Candidate[],
  skips: Skip[],
): void {
  console.log(`Plan for ${file} (dry run - nothing written):`);
  for (const a of actions) {
    const label =
      a.kind === 'write' && a.finalName !== a.key
        ? `${a.key} -> ${a.finalName} (rename)`
        : a.kind === 'write'
          ? `${a.finalName} (new)`
          : a.kind === 'overwrite'
            ? `${a.finalName} (overwrite)`
            : `${a.finalName} (already in vault, ref rewritten)`;
    console.log(`  import: ${label}`);
  }
  const selectedKeys = new Set(selected.map((c) => c.key));
  for (const c of candidates) {
    if (!selectedKeys.has(c.key)) console.log(`  skip:   ${c.key} (deselected)`);
  }
  for (const s of skips) console.log(`  ignore: ${s.key} (${s.reason})`);
}
