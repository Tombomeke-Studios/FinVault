import { describe, it, expect } from 'vitest';
import { buildEpcQr, isValidRfReference, parseEpcQr } from './epc';

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
});

describe('RF creditor references (NexusInfra QR top-ups)', () => {
  // ISO 11649's own example, and the same body with a wrong check.
  it('accepts a valid reference and refuses a wrong check or shape', () => {
    expect(isValidRfReference('RF18539007547034')).toBe(true);
    expect(isValidRfReference('RF18 5390 0754 7034')).toBe(true);
    expect(isValidRfReference('RF19539007547034')).toBe(false);
    expect(isValidRfReference('RF18')).toBe(false);
    expect(isValidRfReference('XX18539007547034')).toBe(false);
    expect(isValidRfReference('RF18' + 'A'.repeat(22))).toBe(false);
  });

  it('writes the reference to the structured field and reads it back', () => {
    const payload = buildEpcQr({ name: 'NexusInfra', iban: 'BE89377007719941', amount: 10, reference: 'RF18539007547034', description: 'ignored' });
    const lines = payload.split('\n');
    expect(lines[9]).toBe('RF18539007547034');
    expect(lines[10]).toBe(''); // a structured reference or remittance text, never both
    expect(parseEpcQr(payload)).toEqual({ name: 'NexusInfra', iban: 'BE89377007719941', amount: 10, reference: 'RF18539007547034' });
  });

  it('drops an invalid reference rather than paying the wrong request', () => {
    expect(buildEpcQr({ name: 'X', iban: 'BE89377007719941', reference: 'RF19539007547034' }).split('\n')[9]).toBe('');
    expect(parseEpcQr('BCD\n002\n1\nSCT\n\nX\nBE89377007719941\nEUR5.00\n\nRF19539007547034\n')?.reference).toBeUndefined();
  });
});

describe('parseEpcQr tolerance (known bug: valid codes were refused)', () => {
  it('accepts a byte-order mark, lone CR line ends and padded header lines', () => {
    const body = 'BCD \n002\n1\n SCT\n\nX\nBE89377007719941\nEUR5.00\n\n\nLunch';
    expect(parseEpcQr('﻿' + body)?.amount).toBe(5);
    expect(parseEpcQr(body.replace(/\n/g, '\r'))?.description).toBe('Lunch');
  });
});
