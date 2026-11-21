import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
// @ts-expect-error plain JS script, no type declarations
import { ensureEnvFile } from './ensure-env.js';

function fakeFs(files: string[]) {
  const present = new Set(files);
  const copies: Array<[string, string]> = [];
  return {
    copies,
    exists: (p: string) => present.has(p),
    copy: (from: string, to: string) => { copies.push([from, to]); present.add(to); },
  };
}

describe('ensureEnvFile', () => {
  const root = '/repo';

  it('copies .env.example to .env when .env is missing', () => {
    const fs = fakeFs([join(root, '.env.example')]);
    expect(ensureEnvFile(root, fs)).toBe('created');
    expect(fs.copies).toEqual([[join(root, '.env.example'), join(root, '.env')]]);
  });

  it('never overwrites an existing .env', () => {
    const fs = fakeFs([join(root, '.env'), join(root, '.env.example')]);
    expect(ensureEnvFile(root, fs)).toBe('exists');
    expect(fs.copies).toEqual([]);
  });

  it('reports when there is nothing to copy from', () => {
    const fs = fakeFs([]);
    expect(ensureEnvFile(root, fs)).toBe('no-example');
    expect(fs.copies).toEqual([]);
  });
});
