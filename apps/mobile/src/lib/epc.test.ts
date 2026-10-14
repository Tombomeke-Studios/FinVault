import { describe, it, expect } from 'vitest';
import { buildEpcQr, parseEpcQr } from './epc';

const sample = {
  name: 'Lena Mertens',
  iban: 'BE89 3770 0771 9941',
  amount: 12.5,
  description: 'Dinner split',
};

describe('buildEpcQr', () => {
  it('emits the EPC069-12 layout', () => {
    const lines = buildEpcQr(sample).split('\n');
    expect(lines[0]).toBe('BCD');
    expect(lines[3]).toBe('SCT');
    expect(lines[5]).toBe('Lena Mertens');
    expect(lines[6]).toBe('BE89377007719941');
    expect(lines[7]).toBe('EUR12.50');
    expect(lines[10]).toBe('Dinner split');
  });

  it('omits the amount line when no amount is given', () => {
    expect(buildEpcQr({ name: 'X', iban: 'BE89377007719941' }).split('\n')[7]).toBe('');
  });
});

describe('parseEpcQr', () => {
  it('round-trips a built payload', () => {
    const parsed = parseEpcQr(buildEpcQr(sample));
    expect(parsed).toEqual({
      name: 'Lena Mertens', iban: 'BE89377007719941', amount: 12.5, description: 'Dinner split',
    });
  });

  it('parses a payload without amount or description', () => {
    const parsed = parseEpcQr(buildEpcQr({ name: 'X', iban: 'BE89377007719941' }));
    expect(parsed).toEqual({ name: 'X', iban: 'BE89377007719941', amount: undefined, description: undefined });
  });

  it('rejects non-EPC QR content', () => {
    expect(parseEpcQr('https://example.com')).toBeNull();
    expect(parseEpcQr('')).toBeNull();
  });

  it('rejects payloads with an invalid IBAN or malformed amount', () => {
    expect(parseEpcQr('BCD\n002\n1\nSCT\n\nName\nNOT-AN-IBAN\nEUR5.00\n\n\n')).toBeNull();
    expect(parseEpcQr('BCD\n002\n1\nSCT\n\nName\nBE89377007719941\n5,00\n\n\n')).toBeNull();
  });

  it('handles CRLF payloads from other generators', () => {
    const crlf = buildEpcQr(sample).replace(/\n/g, '\r\n');
    expect(parseEpcQr(crlf)?.iban).toBe('BE89377007719941');
  });

  // #98: every wallet used to be issued a 22-character "Belgian" IBAN. The QR a
  // user showed was built from it, and this parser — correctly — refused it:
  // "That QR is not a SEPA payment code". The parser was never the bug.
  it('refuses the 22-character account numbers FinVault used to issue', () => {
    expect(parseEpcQr(buildEpcQr({ name: 'Ada Lovelace', iban: 'BE89377007711234567890' }))).toBeNull();
  });

  it('reads a QR built from an IBAN as wallets are issued now', () => {
    const parsed = parseEpcQr(buildEpcQr({ name: 'Ada Lovelace', iban: 'BE15377171990030', amount: 12.5, description: 'Lunch' }));
    expect(parsed).toEqual({ name: 'Ada Lovelace', iban: 'BE15377171990030', amount: 12.5, description: 'Lunch' });
  });
});
