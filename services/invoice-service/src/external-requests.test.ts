import { describe, it, expect, beforeEach } from 'vitest';
import type { FinVaultEvent } from 'shared';
import {
  createExternalRequests,
  parseExternalRequest,
  settlementEvent,
  type ExternalRequestStore,
  type Merchant,
  type StoredExternalRequest,
} from './external-requests.js';

type Row = StoredExternalRequest & { recipientEmail: string; notified: boolean };

function memoryStore() {
  const rows: Row[] = [];
  const store: ExternalRequestStore = {
    async findByExternalReference(reference) {
      return rows.find((r) => r.externalReference === reference) ?? null;
    },
    async countPending(recipientEmail, source) {
      return rows.filter((r) => r.recipientEmail === recipientEmail && r.externalSource === source && r.status === 'pending').length;
    },
    async create(input) {
      const row: Row = {
        id: `req-${rows.length + 1}`,
        status: 'pending',
        amount: input.amount,
        externalReference: input.externalReference,
        externalSource: input.externalSource,
        transactionRef: null,
        recipientEmail: input.recipientEmail,
        notified: false,
      };
      rows.push(row);
      return row;
    },
    async listUnnotified() {
      return rows.filter((r) => r.externalReference && !r.notified && (r.status === 'paid' || r.status === 'declined'));
    },
    async markNotified(id) {
      rows.find((r) => r.id === id)!.notified = true;
    },
  };
  return { rows, store };
}

const MERCHANT: Merchant = { userId: 'merchant-1', email: 'billing@host.example' };
const ENVELOPE = { source: 'billing-bridge' };
const request = (over: Record<string, unknown> = {}) => ({
  reference: 'topup-u1-abc',
  senderWalletId: 'u1',
  receiverWalletId: 'nexusinfra',
  amount: 20,
  currency: 'EUR',
  description: 'NexusInfra credit top-up',
  customerEmail: 'Customer@Example.com',
  ...over,
});

describe('parseExternalRequest', () => {
  it('accepts a complete request and normalises the email', () => {
    const parsed = parseExternalRequest(request({ amount: 19.999 }));
    expect(parsed).toEqual({
      ok: true,
      request: { reference: 'topup-u1-abc', customerEmail: 'customer@example.com', amount: 20, currency: 'EUR', description: 'NexusInfra credit top-up' },
    });
  });

  it('names what is wrong, keeping the reference so the requester can be told', () => {
    expect(parseExternalRequest(request({ customerEmail: undefined }))).toMatchObject({ ok: false, reference: 'topup-u1-abc', reason: expect.stringContaining('customer email') });
    expect(parseExternalRequest(request({ amount: 0 }))).toMatchObject({ ok: false, reason: expect.stringContaining('positive') });
    expect(parseExternalRequest(request({ amount: 100_001 }))).toMatchObject({ ok: false, reason: expect.stringContaining('limit') });
    expect(parseExternalRequest(request({ currency: 'USD' }))).toMatchObject({ ok: false, reason: expect.stringContaining('USD') });
  });

  it('has nothing to answer when there is no reference', () => {
    expect(parseExternalRequest({ amount: 5 })).toMatchObject({ ok: false, reference: null });
    expect(parseExternalRequest(null)).toMatchObject({ ok: false, reference: null });
  });
});

describe('external payment requests', () => {
  let mem: ReturnType<typeof memoryStore>;
  let published: FinVaultEvent[];
  let publishOk: boolean;
  let merchant: Merchant | null;
  let svc: ReturnType<typeof createExternalRequests>;

  beforeEach(() => {
    mem = memoryStore();
    published = [];
    publishOk = true;
    merchant = MERCHANT;
    svc = createExternalRequests({
      store: mem.store,
      merchant: async () => merchant,
      publish: async (event) => {
        if (publishOk) published.push(event);
        return publishOk;
      },
      maxPending: 2,
      log: () => undefined,
    });
  });

  it('creates a request addressed to the customer, and says nothing yet', async () => {
    expect(await svc.handle(ENVELOPE, request())).toBe('created');
    expect(mem.rows).toHaveLength(1);
    expect(mem.rows[0]).toMatchObject({ recipientEmail: 'customer@example.com', amount: 20, externalReference: 'topup-u1-abc', externalSource: 'billing-bridge', status: 'pending' });
    expect(published).toEqual([]);
  });

  it('creates nothing new when the same request is delivered again', async () => {
    await svc.handle(ENVELOPE, request());
    expect(await svc.handle(ENVELOPE, request())).toBe('duplicate');
    expect(mem.rows).toHaveLength(1);
    expect(published).toEqual([]);
  });

  it('answers a request it cannot honour with payment.failed and the reason', async () => {
    expect(await svc.handle(ENVELOPE, request({ currency: 'USD' }))).toBe('refused');
    expect(published).toEqual([{ type: 'payment.failed', payload: { transactionId: '', reference: 'topup-u1-abc', reason: expect.stringContaining('USD') } }]);
    expect(mem.rows).toHaveLength(0);
  });

  it('ignores a request with no reference — there is nobody to answer', async () => {
    expect(await svc.handle(ENVELOPE, { amount: 5 })).toBe('ignored');
    expect(published).toEqual([]);
  });

  it('refuses when no merchant account is configured', async () => {
    merchant = null;
    expect(await svc.handle(ENVELOPE, request())).toBe('refused');
    expect(published[0]).toMatchObject({ type: 'payment.failed', payload: { reason: expect.stringContaining('merchant') } });
  });

  it('refuses a request that would have the merchant pay itself', async () => {
    expect(await svc.handle(ENVELOPE, request({ customerEmail: 'BILLING@host.example' }))).toBe('refused');
    expect(mem.rows).toHaveLength(0);
  });

  it('caps the open requests one customer can be sent', async () => {
    await svc.handle(ENVELOPE, request({ reference: 'r1' }));
    await svc.handle(ENVELOPE, request({ reference: 'r2' }));
    expect(await svc.handle(ENVELOPE, request({ reference: 'r3' }))).toBe('refused');
    expect(published).toEqual([{ type: 'payment.failed', payload: { transactionId: '', reference: 'r3', reason: expect.stringContaining('already 2 open') } }]);
    // Settling one makes room again.
    mem.rows[0].status = 'declined';
    expect(await svc.handle(ENVELOPE, request({ reference: 'r4' }))).toBe('created');
  });

  it('lets a failing merchant lookup throw, so the message is not silently dropped as handled', async () => {
    const failing = createExternalRequests({ store: mem.store, merchant: async () => { throw new Error('account service unreachable'); }, publish: async () => true, log: () => undefined });
    await expect(failing.handle(ENVELOPE, request())).rejects.toThrow('unreachable');
  });

  it('confirms a paid request with the requester’s own reference and amount', async () => {
    await svc.handle(ENVELOPE, request());
    Object.assign(mem.rows[0], { status: 'paid', transactionRef: 'TXN-123' });
    expect(await svc.notify(mem.rows[0])).toBe(true);
    expect(published).toEqual([
      { type: 'payment.confirmed', payload: { transactionId: 'TXN-123', reference: 'topup-u1-abc', amount: 20, senderWalletId: '', receiverWalletId: 'billing-bridge' } },
    ]);
    expect(mem.rows[0].notified).toBe(true);
  });

  it('reports a declined request as failed', async () => {
    await svc.handle(ENVELOPE, request());
    mem.rows[0].status = 'declined';
    await svc.notify(mem.rows[0]);
    expect(published).toEqual([{ type: 'payment.failed', payload: { transactionId: '', reference: 'topup-u1-abc', reason: expect.stringContaining('declined') } }]);
  });

  it('keeps an answer that did not reach the bus, and sends it on the next flush', async () => {
    await svc.handle(ENVELOPE, request());
    Object.assign(mem.rows[0], { status: 'paid', transactionRef: 'TXN-123' });
    publishOk = false;
    expect(await svc.notify(mem.rows[0])).toBe(false);
    expect(mem.rows[0].notified).toBe(false);

    publishOk = true;
    expect(await svc.flush()).toBe(1);
    expect(published).toHaveLength(1);
    expect(await svc.flush()).toBe(0);
  });

  it('has nothing to say about an ordinary request between two FinVault users', () => {
    expect(settlementEvent({ id: 'x', status: 'paid', amount: 5, externalReference: null, externalSource: null, transactionRef: 'TXN-1' })).toBeNull();
    expect(settlementEvent({ id: 'x', status: 'pending', amount: 5, externalReference: 'r', externalSource: 's', transactionRef: null })).toBeNull();
  });
});
