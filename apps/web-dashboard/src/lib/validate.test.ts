import { describe, it, expect } from 'vitest';
import { isEmail, isValidIbanFormat, normalizeIban, classifyRecipient } from './validate';

describe('isEmail', () => {
  it('accepts normal addresses', () => {
    expect(isEmail('lena@finvault.com')).toBe(true);
    expect(isEmail(' user@sub.domain.be ')).toBe(true);
  });
  it('rejects malformed addresses', () => {
    expect(isEmail('lena@finvault')).toBe(false);
    expect(isEmail('not-an-email')).toBe(false);
    expect(isEmail('a b@c.de')).toBe(false);
  });
});

describe('isValidIbanFormat', () => {
  it('accepts BE/NL IBANs with or without spaces', () => {
    expect(isValidIbanFormat('BE89 3770 0771 9941')).toBe(true);
    expect(isValidIbanFormat('nl91abna0417164300')).toBe(true);
  });
  it('enforces known country lengths', () => {
    expect(isValidIbanFormat('BE89377007719941123')).toBe(false);
  });
  it('rejects junk', () => {
    expect(isValidIbanFormat('hello world')).toBe(false);
  });
});

describe('classifyRecipient', () => {
  it('classifies email, iban, and invalid input', () => {
    expect(classifyRecipient('maya@finvault.com')).toBe('email');
    expect(classifyRecipient('BE89 3770 0771 9941')).toBe('iban');
    expect(classifyRecipient('Maya')).toBe('invalid');
    expect(classifyRecipient('')).toBe('invalid');
  });
});
