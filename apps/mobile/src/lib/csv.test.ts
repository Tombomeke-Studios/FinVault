import { describe, it, expect } from 'vitest';
import { buildTransactionsCsv, exportFileName } from './csv';

describe('buildTransactionsCsv (mobile mirror)', () => {
  it('emits header + CRLF rows with two-decimal amounts', () => {
    const csv = buildTransactionsCsv([{
      date: '2026-06-11T10:00:00.000Z', description: 'Salary', category: 'deposit',
      status: 'confirmed', amount: 3200, currency: 'EUR',
    }]);
    expect(csv).toBe('Date,Description,Category,Status,Amount,Currency\r\n2026-06-11T10:00:00.000Z,Salary,deposit,confirmed,3200.00,EUR');
  });

  it('escapes commas and quotes', () => {
    const csv = buildTransactionsCsv([{
      date: 'd', description: 'Rent, "June"', category: 'bills',
      status: 'confirmed', amount: -800, currency: 'EUR',
    }]);
    expect(csv.split('\r\n')[1]).toContain('"Rent, ""June"""');
  });
});

describe('exportFileName', () => {
  it('uses the ISO date', () => {
    expect(exportFileName(new Date('2026-06-11T15:30:00Z'))).toBe('finvault-transactions-2026-06-11.csv');
  });
});
