// IBAN helpers for transfer-target validation (#9/#11).
//
// Wallets are issued real Belgian IBANs (`generateBelgianIban`, #98): 16
// characters, valid national and mod-97 check digits. They used to be a prefix
// plus ten random digits — 22 characters, which the format check below rejects,
// so FinVault could not validate its own account numbers.
// Routes validate format; the checksum is exported for callers that want it.

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

/** n mod 97 for a number given as a string of digits of any length. */
function mod97(digits: string): number {
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder;
}

/** FinVault's (fictional) Belgian bank code — the first three digits of every account. */
const BANK_CODE = '377';

/**
 * A new Belgian IBAN: `BE` + 2 check digits + a 12-digit account number
 * (bank code, 7 digits, and the national check: the first ten digits mod 97,
 * with 97 standing in for 0). Passes `isValidIbanChecksum`.
 *
 * `random` is injectable so tests are deterministic.
 */
export function generateBelgianIban(random: () => number = Math.random): string {
  const account = String(Math.floor(random() * 10_000_000)).padStart(7, '0');
  const firstTen = BANK_CODE + account;
  const national = mod97(firstTen) || 97;
  const bban = firstTen + String(national).padStart(2, '0');
  // ISO 13616: check = 98 - (BBAN + country as digits + "00") mod 97; B=11, E=14.
  const check = 98 - mod97(`${bban}111400`);
  return `BE${String(check).padStart(2, '0')}${bban}`;
}
