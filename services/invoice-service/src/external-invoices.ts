import { createHash } from 'crypto';
import type { EventEnvelope } from 'shared';
import { normalizeEmail } from './external-requests.js';

// Monthly statements from another system (#94). NexusInfra's hosted edition
// publishes `invoice.generate` when a billing month closes: what a customer's
// servers used, charged against credit they prepaid through FinVault. Recorded
// here so the customer can see, next to the top-ups that left their account,
// what that money was spent on.
//
// A statement is not a payment. No money moves — it already did, when the
// customer paid the top-up — and the description says so.
//
// Dependency-injected like external-requests.ts: no database, broker or other
// service is needed to test it.

/** The routing key NexusInfra publishes statements on. */
export const EXTERNAL_INVOICE_KEY = 'invoice.generate';

export interface ExternalInvoice {
  reference: string;
  customerEmail: string;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
}

export type InvoiceParse = { ok: true; invoice: ExternalInvoice } | { ok: false; reason: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isDate = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));

export function parseExternalInvoice(payload: unknown): InvoiceParse {
  const p = (payload ?? {}) as Record<string, unknown>;
  if (typeof p.reference !== 'string' || !p.reference.trim()) return { ok: false, reason: 'the statement carries no reference' };
  if (typeof p.customerEmail !== 'string' || !EMAIL.test(p.customerEmail.trim())) return { ok: false, reason: 'the statement does not say whose it is (no customer email)' };
  if (typeof p.amount !== 'number' || !Number.isFinite(p.amount) || p.amount <= 0) return { ok: false, reason: 'the amount must be positive' };
  if (!isDate(p.periodStart) || !isDate(p.periodEnd)) return { ok: false, reason: 'the period is missing or not a date' };
  return {
    ok: true,
    invoice: {
      reference: p.reference.trim(),
      customerEmail: normalizeEmail(p.customerEmail),
      amount: Math.round(p.amount * 100) / 100,
      currency: typeof p.currency === 'string' && p.currency ? p.currency.toUpperCase() : 'EUR',
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
    },
  };
}

/**
 * The reference a statement is stored and filed under. The requester's own
 * reference is free text — NexusInfra's contains colons, which are not allowed
 * in a file name on Windows, and the PDF is named after this. So: a short label,
 * the month, and a digest of the original. The same statement always gets the
 * same reference, which is what makes a redelivery a no-op.
 */
export function statementRef(invoice: Pick<ExternalInvoice, 'reference' | 'periodStart'>): string {
  const month = new Date(invoice.periodStart).toISOString().slice(0, 7);
  const digest = createHash('sha256').update(invoice.reference).digest('hex').slice(0, 10).toUpperCase();
  return `HOST-${month}-${digest}`;
}

/** "September 2026", from the first instant of the period (UTC, as NexusInfra bills). */
export function periodLabel(periodStart: string): string {
  return new Date(periodStart).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function statementDescription(invoice: Pick<ExternalInvoice, 'periodStart'>): string {
  return `Server hosting — usage for ${periodLabel(invoice.periodStart)}, paid from your prepaid credit`;
}

export interface ExternalInvoiceDeps {
  store: {
    exists(transactionRef: string): Promise<boolean>;
    create(input: { transactionRef: string; payerUserId: string; payerEmail: string; payeeEmail: string | null; amount: number; currency: string; description: string }): Promise<void>;
  };
  /** The FinVault account with this address, or null. Throws when it cannot be asked. */
  resolveUser: (email: string) => Promise<{ id: string; email: string } | null>;
  /** Who the hosting was bought from, shown on the statement; null when not configured. */
  merchantEmail: string | null;
  log?: (message: string) => void;
}

export type InvoiceOutcome = 'recorded' | 'duplicate' | 'ignored';

export function createExternalInvoices(deps: ExternalInvoiceDeps) {
  const log = deps.log ?? ((m: string) => console.log(`[Invoice Service] ${m}`));

  return {
    /** Handle one `invoice.generate` from the bus. Throws only when retrying could help. */
    async handle(envelope: Pick<EventEnvelope, 'source'>, payload: unknown): Promise<InvoiceOutcome> {
      const parsed = parseExternalInvoice(payload);
      if (!parsed.ok) {
        log(`ignored a statement from ${envelope.source}: ${parsed.reason}`);
        return 'ignored';
      }
      const { invoice } = parsed;
      const transactionRef = statementRef(invoice);
      // The broker delivers at least once.
      if (await deps.store.exists(transactionRef)) return 'duplicate';

      const user = await deps.resolveUser(invoice.customerEmail);
      if (!user) {
        // Nobody to show it to. Not an error: the customer may have paid some
        // other way, or closed their account.
        log(`statement ${invoice.reference} from ${envelope.source} is for an address with no account here; not recorded`);
        return 'ignored';
      }
      await deps.store.create({
        transactionRef,
        payerUserId: user.id,
        payerEmail: user.email,
        payeeEmail: deps.merchantEmail,
        amount: invoice.amount,
        currency: invoice.currency,
        description: statementDescription(invoice),
      });
      log(`statement ${transactionRef} recorded for ${invoice.reference} (${envelope.source})`);
      return 'recorded';
    },
  };
}
