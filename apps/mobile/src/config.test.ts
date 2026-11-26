import { describe, expect, it } from 'vitest';
import { DEFAULT_API_URL, resolveApiUrl, resolveDemoMode } from './config';

describe('resolveApiUrl', () => {
  it('falls back to the default server when unset or blank', () => {
    expect(resolveApiUrl(undefined)).toBe(DEFAULT_API_URL);
    expect(resolveApiUrl('   ')).toBe(DEFAULT_API_URL);
  });

  it('trims whitespace and trailing slashes so paths join cleanly', () => {
    expect(resolveApiUrl(' https://api.example.com/// ')).toBe('https://api.example.com');
  });

  it('keeps a configured URL as-is', () => {
    expect(resolveApiUrl('http://10.0.0.5:8000')).toBe('http://10.0.0.5:8000');
  });
});

describe('resolveDemoMode', () => {
  it('follows the build type when not set', () => {
    expect(resolveDemoMode(undefined, true)).toBe(true);
    expect(resolveDemoMode(undefined, false)).toBe(false);
  });

  it('honours an explicit override either way', () => {
    expect(resolveDemoMode('1', false)).toBe(true);
    expect(resolveDemoMode('true', false)).toBe(true);
    expect(resolveDemoMode('0', true)).toBe(false);
    expect(resolveDemoMode('false', true)).toBe(false);
  });
});
