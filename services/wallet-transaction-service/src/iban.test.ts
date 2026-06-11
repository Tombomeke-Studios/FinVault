import { describe, it, expect } from 'vitest';
import { normalizeIban, isValidIbanFormat, isValidIbanChecksum } from './iban.js';

describe('normalizeIban', () => {
  it('strips spaces and uppercases', () => {
    expect(normalizeIban('be89 3770 0771 9941')).toBe('BE89377007719941');
  });
  it('handles empty input', () => {
    expect(normalizeIban('')).toBe('');
  });
});

describe('isValidIbanFormat', () => {
  it('accepts a well-formed BE IBAN (with or without spaces)', () => {
    expect(isValidIbanFormat('BE89 3770 0771 9941')).toBe(true);
    expect(isValidIbanFormat('BE89377007719941')).toBe(true);
  });
  it('accepts seeded demo IBANs (random digits, correct structure)', () => {
    expect(isValidIbanFormat('BE8937700771123456'.slice(0, 16))).toBe(true);
  });
  it('enforces known country lengths', () => {
    expect(isValidIbanFormat('BE893770077199410')).toBe(false); // 17 chars, BE needs 16
    expect(isValidIbanFormat('NL91ABNA0417164300')).toBe(true); // 18 chars
  });
  it('rejects malformed input', () => {
    expect(isValidIbanFormat('1234')).toBe(false);
    expect(isValidIbanFormat('BEXX377007719941')).toBe(false);
    expect(isValidIbanFormat('lena@finvault.com')).toBe(false);
  });
});

describe('isValidIbanChecksum', () => {
  it('passes for real checksummed IBANs', () => {
    expect(isValidIbanChecksum('BE68 5390 0754 7034')).toBe(true);
    expect(isValidIbanChecksum('NL91 ABNA 0417 1643 00')).toBe(true);
  });
  it('fails when a digit is corrupted', () => {
    expect(isValidIbanChecksum('BE68 5390 0754 7035')).toBe(false);
  });
});
