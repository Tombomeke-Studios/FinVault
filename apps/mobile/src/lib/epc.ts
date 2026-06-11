// EPC QR (EPC069-12) — the SEPA Credit Transfer QR standard used by
// Payconiq-class payment apps (#43). Pure string logic, unit-tested.
//
// Payload layout (newline-separated, in order):
//   BCD            service tag
//   002            version
//   1              charset (1 = UTF-8)
//   SCT            identification (SEPA Credit Transfer)
//   <BIC>          optional in version 002
//   <name>         beneficiary name (required)
//   <IBAN>         beneficiary account (required)
//   EUR<amount>    optional, e.g. EUR12.50
//   <purpose>      optional 4-char purpose code
//   <reference>    optional structured reference
//   <remittance>   optional unstructured remittance info (description)

import { isValidIbanFormat, normalizeIban } from './validate';

export interface EpcPayment {
  name: string;
  iban: string;
  amount?: number;
  description?: string;
}

export function buildEpcQr(p: EpcPayment): string {
  const amount = p.amount && p.amount > 0 ? `EUR${p.amount.toFixed(2)}` : '';
  return [
    'BCD', '002', '1', 'SCT',
    '',                              // BIC (optional in v002)
    (p.name || '').trim().slice(0, 70),
    normalizeIban(p.iban),
    amount,
    '',                              // purpose
    '',                              // structured reference
    (p.description || '').trim().slice(0, 140),
  ].join('\n');
}

/** Parses an EPC payload; returns null when the QR is not a SEPA transfer QR. */
export function parseEpcQr(raw: string): EpcPayment | null {
  if (!raw || typeof raw !== 'string') return null;
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  if (lines[0] !== 'BCD' || lines[3] !== 'SCT') return null;

  const name = (lines[5] || '').trim();
  const iban = normalizeIban(lines[6] || '');
  if (!name || !isValidIbanFormat(iban)) return null;

  let amount: number | undefined;
  const amtRaw = (lines[7] || '').trim();
  if (amtRaw) {
    const m = /^EUR(\d+(?:\.\d{1,2})?)$/.exec(amtRaw);
    if (!m) return null; // malformed amount — refuse rather than guess
    amount = parseFloat(m[1]);
  }

  const description = (lines[10] || '').trim() || undefined;
  return { name, iban, amount, description };
}
