import { describe, it, expect } from 'vitest';
import { buildTransactionsCsv, exportFileName, type ExportRow } from './csv';

const row = (over: Partial<ExportRow> = {}): ExportRow => ({
  date: '2026-06-11T10:00:00.000Z',
  description: 'Albert Heijn',
  category: 'groceries',
  status: 'confirmed',
  amount: -42.5,
  currency: 'EUR',
  ...over,
});

describe('buildTransactionsCsv', () => {
  it('emits a header plus one CRLF-separated line per row', () => {
    const csv = buildTransactionsCsv([row(), row({ description: 'Salary', amount: 3200 })]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('Date,Description,Category,Status,Amount,Currency');
    expect(lines[1]).toBe('2026-06-11T10:00:00.000Z,Albert Heijn,groceries,confirmed,-42.50,EUR');
    expect(lines[2]).toContain('3200.00');
  });

  it('quotes and escapes fields containing commas, quotes or newlines', () => {
    const csv = buildTransactionsCsv([row({ description: 'Rent, "June"' })]);
    expect(csv.split('\r\n')[1]).toContain('"Rent, ""June"""');
  });

  it('renders amounts with two decimals', () => {
    const csv = buildTransactionsCsv([row({ amount: 10 })]);
    expect(csv).toContain('10.00');
  });

  it('handles an empty list with just the header', () => {
    expect(buildTransactionsCsv([])).toBe('Date,Description,Category,Status,Amount,Currency');
  });
});

describe('exportFileName', () => {
  it('uses the ISO date', () => {
    expect(exportFileName(new Date('2026-06-11T15:30:00Z'))).toBe('finvault-transactions-2026-06-11.csv');
  });
});
