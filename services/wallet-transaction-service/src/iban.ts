// IBAN helpers for transfer-target validation (#9/#11).
//
// Note on checksum: seeded demo wallets get IBANs with random trailing digits
// (see seedAccounts), so they are *structurally* valid but rarely pass mod-97.
// Routes therefore validate format only; the checksum is exported for callers
// that deal with real-world IBANs (and for tests).

const IBAN_LENGTHS: Record<string, number> = {
  BE: 16, NL: 18, DE: 22, FR: 27, LU: 20, ES: 24, IT: 27, PT: 25, AT: 20, IE: 22,
};

export function normalizeIban(input: string): string {
  return (input || '').replace(/\s+/g, '').toUpperCase();
}

/** Structure check: 2 letters + 2 digits + 11..30 alphanumerics, with exact
 *  length enforcement for the country codes we know. */
export function isValidIbanFormat(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const expected = IBAN_LENGTHS[iban.slice(0, 2)];
  return expected === undefined || iban.length === expected;
}

/** Full ISO 13616 mod-97 checksum. */
export function isValidIbanChecksum(input: string): boolean {
  const iban = normalizeIban(input);
  if (!isValidIbanFormat(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const value = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const digit of value) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}
