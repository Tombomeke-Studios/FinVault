import { describe, it, expect } from 'vitest';
import { classifyRecipient, isValidIbanFormat } from './validate';

describe('classifyRecipient (mobile mirror)', () => {
  it('classifies email, iban, and invalid input', () => {
    expect(classifyRecipient('maya@finvault.com')).toBe('email');
    expect(classifyRecipient('be89 3770 0771 9941')).toBe('iban');
    expect(classifyRecipient('Maya')).toBe('invalid');
  });
});

describe('isValidIbanFormat (mobile mirror)', () => {
  it('enforces known country lengths', () => {
    expect(isValidIbanFormat('BE89377007719941')).toBe(true);
    expect(isValidIbanFormat('BE8937700771994')).toBe(false);
  });
});
