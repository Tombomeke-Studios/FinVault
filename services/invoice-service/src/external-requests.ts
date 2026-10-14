import type { EventEnvelope, FinVaultEvent } from 'shared';

// Payment requests that come from another system over the event bus, rather than
// from a signed-in FinVault user (#89). NexusInfra's hosted edition publishes
// `payment.request` on `bank.payment.request` when a customer tops up their
// credit; this turns it into an ordinary payment request the customer approves
// in FinVault, and answers with `payment.confirmed` / `payment.failed` carrying
// the requester's own reference.
//
// Everything here is dependency-injected (store, merchant lookup, publisher) so
// it is tested without a database, a broker or the other services.

/** The routing key external requesters publish on. FinVault's own events use `events.<type>`. */
export const EXTERNAL_REQUEST_KEY = 'bank.payment.request';
export const EXTERNAL_REQUEST_QUEUE = 'finvault.invoice.external-requests';

/**
 * How many unanswered external requests one recipient may have. The email comes
 * from the requesting system, which may not have verified it — without a cap,
 * anyone able to register there could fill a stranger's inbox with requests.
 */
export const DEFAULT_MAX_PENDING = 5;

export const MAX_EXTERNAL_AMOUNT = 100_000;

export interface ExternalRequest {
  reference: string;
  customerEmail: string;
  amount: number;
  currency: string;
  description: string;
}

export type ParseResult =
  | { ok: true; request: ExternalRequest }
  /** `reference` is set when the request can at least be answered. */
  | { ok: false; reference: string | null; reason: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

/** Validate an incoming payload. Money is rounded to cents: the ledger stores amounts, not floats. */
export function parseExternalRequest(payload: unknown): ParseResult {
  const p = (payload ?? {}) as Record<string, unknown>;
  const reference = typeof p.reference === 'string' && p.reference.trim() ? p.reference.trim() : null;
  const refuse = (reason: string): ParseResult => ({ ok: false, reference, reason });

  if (!reference) return refuse('the request carries no reference');
  if (reference.length > 200) return { ok: false, reference: null, reason: 'the reference is too long' };
  if (typeof p.customerEmail !== 'string' || !EMAIL.test(p.customerEmail.trim())) {
    return refuse('the request does not say who should pay (no customer email)');
  }
  if (typeof p.amount !== 'number' || !Number.isFinite(p.amount) || p.amount <= 0) return refuse('the amount must be positive');
  if (p.amount > MAX_EXTERNAL_AMOUNT) return refuse(`the amount is above the €${MAX_EXTERNAL_AMOUNT.toLocaleString('en-US')} limit`);
  const currency = typeof p.currency === 'string' && p.currency ? p.currency.toUpperCase() : 'EUR';
  if (currency !== 'EUR') return refuse(`${currency} is not supported — requests are paid from a EUR account`);

  const description = typeof p.description === 'string' && p.description.trim() ? p.description.trim().slice(0, 200) : 'Payment request';
  return {
    ok: true,
    request: { reference, customerEmail: normalizeEmail(p.customerEmail), amount: Math.round(p.amount * 100) / 100, currency, description },
  };
}

/** The FinVault account that receives the money. */
export interface Merchant {
  userId: string;
  email: string;
}

/** The stored fields this module needs from a payment request. */
export interface StoredExternalRequest {
  id: string;
  status: string;
  amount: number;
  externalReference: string | null;
  externalSource: string | null;
  transactionRef: string | null;
}

export interface ExternalRequestStore {
  findByExternalReference(reference: string): Promise<StoredExternalRequest | null>;
  countPending(recipientEmail: string, source: string): Promise<number>;
  create(input: {
    merchant: Merchant;
    recipientEmail: string;
    amount: number;
    currency: string;
    description: string;
    externalReference: string;
    externalSource: string;
  }): Promise<StoredExternalRequest>;
  /** Paid or declined external requests whose requester has not been told yet. */
  listUnnotified(): Promise<StoredExternalRequest[]>;
  markNotified(id: string): Promise<void>;
}

export type Publish = (event: FinVaultEvent) => Promise<boolean>;

export interface ExternalRequestDeps {
  store: ExternalRequestStore;
  /** Resolves the merchant account; null when none is configured or it does not exist. Throws when it cannot be asked. */
  merchant: () => Promise<Merchant | null>;
  publish: Publish;
  maxPending?: number;
  log?: (message: string) => void;
}

export type Outcome = 'created' | 'duplicate' | 'refused' | 'ignored';

const failed = (reference: string, reason: string): FinVaultEvent => ({
  type: 'payment.failed',
  payload: { transactionId: '', reference, reason },
});

/**
 * The event that tells the requester how its request ended, or null while it is
 * still open (or was never external).
 */
export function settlementEvent(request: StoredExternalRequest): FinVaultEvent | null {
  if (!request.externalReference) return null;
  if (request.status === 'paid') {
    return {
      type: 'payment.confirmed',
      payload: {
        transactionId: request.transactionRef ?? request.id,
        reference: request.externalReference,
        amount: request.amount,
        senderWalletId: '',
        receiverWalletId: request.externalSource ?? '',
      },
    };
  }
  if (request.status === 'declined') return failed(request.externalReference, 'the customer declined the request');
  return null;
}

export function createExternalRequests(deps: ExternalRequestDeps) {
  const { store, publish } = deps;
  const maxPending = deps.maxPending ?? DEFAULT_MAX_PENDING;
  const log = deps.log ?? ((m: string) => console.log(`[Invoice Service] ${m}`));

  /**
   * Tell the requester about one settled request. The answer is marked as sent
   * only when the publish succeeded, so `flush` retries it — the customer's
   * money has moved by then, and a lost confirmation is credit they never get.
   */
  async function notify(request: StoredExternalRequest): Promise<boolean> {
    const event = settlementEvent(request);
    if (!event) return false;
    if (!(await publish(event))) {
      log(`could not report ${request.externalReference} as ${request.status}; will retry`);
      return false;
    }
    await store.markNotified(request.id);
    return true;
  }

  return {
    notify,

    /** Retry every answer that has not reached the bus yet. Returns how many were sent. */
    async flush(): Promise<number> {
      let sent = 0;
      for (const request of await store.listUnnotified()) {
        if (await notify(request)) sent++;
      }
      return sent;
    },

    /** Handle one `payment.request` from the bus. Throws only when retrying could help. */
    async handle(envelope: Pick<EventEnvelope, 'source'>, payload: unknown): Promise<Outcome> {
      const parsed = parseExternalRequest(payload);
      if (!parsed.ok) {
        if (!parsed.reference) {
          log(`ignored a payment request from ${envelope.source}: ${parsed.reason}`);
          return 'ignored';
        }
        log(`refused ${parsed.reference} from ${envelope.source}: ${parsed.reason}`);
        await publish(failed(parsed.reference, parsed.reason));
        return 'refused';
      }
      const { request } = parsed;

      // The broker delivers at least once; the same reference is the same request.
      if (await store.findByExternalReference(request.reference)) return 'duplicate';

      const refuse = async (reason: string): Promise<Outcome> => {
        log(`refused ${request.reference} from ${envelope.source}: ${reason}`);
        await publish(failed(request.reference, reason));
        return 'refused';
      };

      const merchant = await deps.merchant();
      if (!merchant) return refuse('FinVault has no merchant account configured to receive this payment');
      if (normalizeEmail(merchant.email) === request.customerEmail) return refuse('the merchant account cannot pay itself');
      if ((await store.countPending(request.customerEmail, envelope.source)) >= maxPending) {
        return refuse(`there are already ${maxPending} open requests for this customer — pay or decline one in FinVault first`);
      }

      const created = await store.create({
        merchant,
        recipientEmail: request.customerEmail,
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        externalReference: request.reference,
        externalSource: envelope.source,
      });
      log(`payment request ${created.id} created for ${request.reference} (${envelope.source})`);
      return 'created';
    },
  };
}

export type ExternalRequests = ReturnType<typeof createExternalRequests>;
