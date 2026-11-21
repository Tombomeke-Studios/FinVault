#!/usr/bin/env node
/**
 * Creates the root `.env` from `.env.example` when it is missing.
 *
 * Every service starts with `node --env-file=../../.env`, and Node refuses to
 * start at all when that file does not exist ("node: ../../.env: not found",
 * exit code 9). On a fresh clone that meant all four services died at once,
 * while both apps quietly fell back to their offline demo data — so the
 * backend looked broken with no obvious reason.
 *
 * The example's secrets are empty, which makes every service use its built-in
 * development fallback (and warn about it). Fine for local development; set
 * real values before deploying.
 */
import { copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @param {string} root  Directory that holds `.env.example`.
 * @param {{ exists: (p: string) => boolean, copy: (from: string, to: string) => void }} [fs]
 * @returns {'exists' | 'created' | 'no-example'}
 */
export function ensureEnvFile(root, fs = { exists: existsSync, copy: copyFileSync }) {
  const target = join(root, '.env');
  if (fs.exists(target)) return 'exists';
  const example = join(root, '.env.example');
  if (!fs.exists(example)) return 'no-example';
  fs.copy(example, target);
  return 'created';
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const result = ensureEnvFile(root);
  if (result === 'created') {
    console.log('ensure-env: no .env found — created one from .env.example (development defaults).');
  } else if (result === 'no-example') {
    console.warn('ensure-env: no .env and no .env.example — the services will not start.');
  }
}
