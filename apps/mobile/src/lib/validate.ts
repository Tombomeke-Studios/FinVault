// Recipient validation for the transfer flow (#9) — mirrors
// apps/web-dashboard/src/lib/validate.ts and the server-side rules in
// services/wallet-transaction-service/src/iban.ts (format only: seeded demo
// IBANs are structurally valid but not mod-97 checksummed).

const IBAN_LENGTHS: Record<string, number> = {
  BE: 16, NL: 18, DE: 22, FR: 27, LU: 20, ES: 24, IT: 27, PT: 25, AT: 20, IE: 22,
};

export function isEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}

export function normalizeIban(input: string): string {
  return (input || '').replace(/\s+/g, '').toUpperCase();
}

export function isValidIbanFormat(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const expected = IBAN_LENGTHS[iban.slice(0, 2)];
  return expected === undefined || iban.length === expected;
}

export type RecipientKind = 'email' | 'iban' | 'invalid';

export function classifyRecipient(input: string): RecipientKind {
  const v = input.trim();
  if (isEmail(v)) return 'email';
  if (isValidIbanFormat(v)) return 'iban';
  return 'invalid';
}
