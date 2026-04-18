#!/usr/bin/env node
/**
 * Species canon guardrails — fail CI on new drift patterns.
 * @see docs/adr/0001-species-canon-boundaries.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  '.git',
  'coverage',
  'playwright-report',
  'test-results',
]);

const LOCALHOST_SIM = /localhost:310[12]/;
const TS_NOCHECK = /@ts-nocheck/;
const MONEY_DIV = /\/\s*1_000_000/;

/** Paths under repo (posix) allowed to mention localhost sim ports */
const LOCALHOST_ALLOW = new Set([
  'docs',
  'scripts/check-canon-guardrails.mjs',
  'scripts/dev-sims.mjs',
  'tests',
  'packages',
  'server.mjs',
  '.cursor',
]);

/** Files allowed to use `/ 1_000_000` style scaling — prefer empty; add only during migrations */
const MONEY_DIV_ALLOW_PREFIXES = [];

/** Baseline @ts-nocheck files — must be empty; CI fails on any @ts-nocheck under src/ */
const TS_NOCHECK_BASELINE = new Set([]);

function walkFiles(dir, acc = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const ent of entries) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(full, acc);
    else if (/\.(ts|tsx|mts|js|mjs)$/.test(ent.name)) acc.push(full);
  }
  return acc;
}

function posixRel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function isAllowedLocalhost(rel) {
  const seg0 = rel.split('/')[0];
  if (LOCALHOST_ALLOW.has(seg0)) return true;
  if (rel.startsWith('scripts/')) return true;
  return false;
}

function isAllowedMoneyDiv(rel) {
  return MONEY_DIV_ALLOW_PREFIXES.some((p) => rel === p || rel.startsWith(p));
}

function main() {
  const files = walkFiles(path.join(ROOT, 'src'));
  const errors = [];

  const tsNoCheckFiles = [];

  for (const file of files) {
    const rel = posixRel(file);
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    if (LOCALHOST_SIM.test(text) && !isAllowedLocalhost(rel)) {
      errors.push(`[localhost-sim] ${rel}: remove hardcoded localhost:3101/3102; use @/config/sim-env or @/lib/sim-gateway`);
    }

    if (MONEY_DIV.test(text) && !isAllowedMoneyDiv(rel)) {
      errors.push(`[money-div] ${rel}: avoid raw / 1_000_000; use @/lib/amount or @/lib/assurance-read-model`);
    }

    if (TS_NOCHECK.test(text)) {
      tsNoCheckFiles.push(rel);
    }
  }

  for (const rel of tsNoCheckFiles) {
    if (!TS_NOCHECK_BASELINE.has(rel)) {
      errors.push(
        `[ts-nocheck] ${rel}: @ts-nocheck not allowed here (allowed only in: ${[...TS_NOCHECK_BASELINE].join(', ')})`,
      );
    }
  }

  if (errors.length) {
    console.error('Canon guardrail failures:\n');
    for (const e of errors) console.error(e);
    process.exit(1);
  }
  console.log('Canon guardrails OK');
}

main();
