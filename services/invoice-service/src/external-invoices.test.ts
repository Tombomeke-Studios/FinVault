import { describe, it, expect, beforeEach } from 'vitest';
import { createExternalInvoices, parseExternalInvoice, periodLabel, statementDescription, statementRef } from './external-invoices.js';

// What NexusInfra's billing bridge emits when September closes.
const invoice = (over: Record<string, unknown> = {}) => ({
  reference: 'invoice-2026-09-01T00:00:00.000Z-2c2c3e91-69f2-4f01-9b88-561b764f013b',
  userId: '2c2c3e91-69f2-4f01-9b88-561b764f013b',
  customerEmail: 'Customer@Example.com',
  periodStart: '2026-09-01T00:00:00.000Z',
  periodEnd: '2026-10-01T00:00:00.000Z',
  amount: 12.345,
  currency: 'EUR',
  ...over,
});
const ENVELOPE = { source: 'billing-bridge' };

describe('parseExternalInvoice', () => {
  it('accepts a complete statement, rounding money to cents', () => {
    expect(parseExternalInvoice(invoice())).toMatchObject({ ok: true, invoice: { customerEmail: 'customer@example.com', amount: 12.35, currency: 'EUR' } });
  });

  it('says what is missing', () => {
    expect(parseExternalInvoice(invoice({ customerEmail: undefined }))).toMatchObject({ ok: false, reason: expect.stringContaining('whose it is') });
    expect(parseExternalInvoice(invoice({ amount: 0 }))).toMatchObject({ ok: false, reason: expect.stringContaining('positive') });
    expect(parseExternalInvoice(invoice({ periodStart: 'last month' }))).toMatchObject({ ok: false, reason: expect.stringContaining('period') });
    expect(parseExternalInvoice(invoice({ reference: '' }))).toMatchObject({ ok: false, reason: expect.stringContaining('reference') });
    expect(parseExternalInvoice(null)).toMatchObject({ ok: false });
  });
});

describe('how a statement is filed and described', () => {
  it('files it under a reference that is safe as a file name, and stable', () => {
    const ref = statementRef(invoice() as { reference: string; periodStart: string });
    expect(ref).toMatch(/^HOST-2026-09-[0-9A-F]{10}$/);
    // NexusInfra's own reference contains colons — not allowed in a Windows file name.
    expect(ref).not.toMatch(/[:\\/*?"<>|]/);
    expect(statementRef(invoice() as { reference: string; periodStart: string })).toBe(ref);
    expect(statementRef(invoice({ reference: 'invoice-2026-09-01T00:00:00.000Z-someone-else' }) as { reference: string; periodStart: string })).not.toBe(ref);
  });

  it('says it is usage paid from credit, not a new payment', () => {
    expect(periodLabel('2026-09-01T00:00:00.000Z')).toBe('September 2026');
    expect(statementDescription({ periodStart: '2026-09-01T00:00:00.000Z' })).toBe('Server hosting — usage for September 2026, paid from your prepaid credit');
  });
});

describe('external statements (#94)', () => {
  let rows: Array<Record<string, unknown>>;
  let svc: ReturnType<typeof createExternalInvoices>;
  let known: Record<string, { id: string; email: string }>;

  beforeEach(() => {
    rows = [];
    known = { 'customer@example.com': { id: 'fv-user-1', email: 'customer@example.com' } };
    svc = createExternalInvoices({
      store: {
        exists: async (ref) => rows.some((r) => r.transactionRef === ref),
        create: async (input) => void rows.push(input),
      },
      resolveUser: async (email) => known[email] ?? null,
      merchantEmail: 'billing@host.example',
      log: () => undefined,
    });
  });

  it('records a statement for the FinVault account with that address', async () => {
    expect(await svc.handle(ENVELOPE, invoice())).toBe('recorded');
    expect(rows).toEqual([
      {
        transactionRef: expect.stringMatching(/^HOST-2026-09-/),
        payerUserId: 'fv-user-1',
        payerEmail: 'customer@example.com',
        payeeEmail: 'billing@host.example',
        amount: 12.35,
        currency: 'EUR',
        description: 'Server hosting — usage for September 2026, paid from your prepaid credit',
      },
    ]);
  });

  it('records nothing new when the same statement is delivered again', async () => {
    await svc.handle(ENVELOPE, invoice());
    expect(await svc.handle(ENVELOPE, invoice())).toBe('duplicate');
    expect(rows).toHaveLength(1);
  });

  it('keeps each month, and each customer, apart', async () => {
    known['other@example.com'] = { id: 'fv-user-2', email: 'other@example.com' };
    await svc.handle(ENVELOPE, invoice());
    await svc.handle(ENVELOPE, invoice({ reference: 'invoice-2026-10-01T00:00:00.000Z-2c2c', periodStart: '2026-10-01T00:00:00.000Z', periodEnd: '2026-11-01T00:00:00.000Z' }));
    await svc.handle(ENVELOPE, invoice({ reference: 'invoice-2026-09-01T00:00:00.000Z-other', customerEmail: 'other@example.com' }));
    expect(rows.map((r) => r.payerUserId)).toEqual(['fv-user-1', 'fv-user-1', 'fv-user-2']);
    expect(new Set(rows.map((r) => r.transactionRef)).size).toBe(3);
  });

  it('skips a statement for an address with no account here', async () => {
    expect(await svc.handle(ENVELOPE, invoice({ customerEmail: 'stranger@example.com' }))).toBe('ignored');
    expect(rows).toEqual([]);
  });

  it('skips a statement that does not say whose it is', async () => {
    expect(await svc.handle(ENVELOPE, invoice({ customerEmail: undefined }))).toBe('ignored');
    expect(rows).toEqual([]);
  });

  it('lets a failing account lookup throw, so the message is not dropped as handled', async () => {
    const failing = createExternalInvoices({
      store: { exists: async () => false, create: async () => undefined },
      resolveUser: async () => {
        throw new Error('account service unreachable');
      },
      merchantEmail: null,
      log: () => undefined,
    });
    await expect(failing.handle(ENVELOPE, invoice())).rejects.toThrow('unreachable');
  });
});
