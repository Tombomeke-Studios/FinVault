import crypto from 'crypto';

/**
 * HMAC secret for transaction integrity hashing.
 * In production: load from HSM or secret vault.
 */
const INTEGRITY_SECRET = process.env.INTEGRITY_SECRET || 'finvault-integrity-hmac-secret-2026';

/**
 * Computes an HMAC-SHA256 hash of the transaction data.
 * This hash is stored alongside the transaction and can later be verified
 * to detect any tampering of transaction records in the database.
 * 
 * @param fields - Object with transaction fields to hash
 * @returns HMAC-SHA256 hex digest
 */
export function computeTransactionHash(fields: {
  senderWalletId: string | null;
  receiverWalletId: string | null;
  amount: number;
  reference: string;
  currency: string;
}): string {
  const data = [
    fields.senderWalletId || 'EXTERNAL',
    fields.receiverWalletId || 'EXTERNAL',
    fields.amount.toFixed(2),
    fields.reference,
    fields.currency
  ].join('|');

  return crypto
    .createHmac('sha256', INTEGRITY_SECRET)
    .update(data)
    .digest('hex');
}

/**
 * Verifies the integrity hash of a transaction record.
 * 
 * @returns true if the hash matches (record is untampered)
 */
export function verifyTransactionHash(
  storedHash: string,
  fields: {
    senderWalletId: string | null;
    receiverWalletId: string | null;
    amount: number;
    reference: string;
    currency: string;
  }
): boolean {
  const computed = computeTransactionHash(fields);
  // Timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(computed, 'hex'),
    Buffer.from(storedHash, 'hex')
  );
}

/**
 * Generates a receipt signature hash for PDF documents.
 * This provides a verifiable "digital stamp" on transaction receipts.
 */
export function computeReceiptSignature(fields: {
  transactionRef: string;
  amount: number;
  payerEmail: string;
  payeeEmail: string;
  date: string;
}): string {
  const data = [
    fields.transactionRef,
    fields.amount.toFixed(2),
    fields.payerEmail,
    fields.payeeEmail,
    fields.date
  ].join('|');

  return crypto
    .createHmac('sha256', INTEGRITY_SECRET)
    .update(data)
    .digest('hex')
    .substring(0, 16) // Short signature for display on PDF
    .toUpperCase();
}
