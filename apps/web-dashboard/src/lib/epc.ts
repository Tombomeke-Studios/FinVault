// EPC QR (EPC069-12) — the SEPA Credit Transfer QR standard used by
// Payconiq-class payment apps (#43). Pure string logic, unit-tested.
// apps/mobile/src/lib/epc.ts is the original: change both together.
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
//   <reference>    optional structured reference — an ISO 11649 RF creditor reference
//   <remittance>   optional unstructured remittance info (description)

import { isValidIbanFormat, normalizeIban } from './validate';

export interface EpcPayment {
  name: string;
  iban: string;
  amount?: number;
  description?: string;
  /**
   * The structured creditor reference, when the QR carries a valid one. A
   * NexusInfra top-up puts its own reference here, which is how scanning it pays
   * that top-up's payment request rather than making an unrelated transfer.
   */
  reference?: string;
}

/** Letters to their ISO 7064 values (A=10 … Z=35), digits as they are. */
function toDigits(input: string): string {
  let out = '';
  for (const ch of input) out += /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
  return out;
}

/** A long digit string modulo 97, chunked so it never leaves a safe integer. */
function mod97(digits: string): number {
  let rest = 0;
  for (let i = 0; i < digits.length; i += 7) rest = Number(String(rest) + digits.slice(i, i + 7)) % 97;
  return rest;
}

/** True for a well-formed ISO 11649 creditor reference (`RF` + 2 check digits + 1–21 characters). */
export function isValidRfReference(input: string): boolean {
  const ref = (input || '').replace(/\s+/g, '').toUpperCase();
  if (!/^RF\d{2}[A-Z0-9]{1,21}$/.test(ref)) return false;
  return mod97(toDigits(ref.slice(4) + ref.slice(0, 4))) === 1;
}

export function buildEpcQr(p: EpcPayment): string {
  const amount = p.amount && p.amount > 0 ? `EUR${p.amount.toFixed(2)}` : '';
  const reference = p.reference && isValidRfReference(p.reference) ? p.reference.replace(/\s+/g, '').toUpperCase() : '';
  return [
    'BCD', '002', '1', 'SCT',
    '',                              // BIC (optional in v002)
    (p.name || '').trim().slice(0, 70),
    normalizeIban(p.iban),
    amount,
    '',                              // purpose
    reference,                       // structured reference
    // EPC allows a structured reference *or* remittance text, not both.
    reference ? '' : (p.description || '').trim().slice(0, 140),
  ].join('\n');
}

/** Parses an EPC payload; returns null when the QR is not a SEPA transfer QR. */
export function parseEpcQr(raw: string): EpcPayment | null {
  if (!raw || typeof raw !== 'string') return null;
  // Tolerate what scanners hand back: a byte-order mark, CRLF or lone CR line
  // ends, and stray spaces around the fixed header lines. Comparing those lines
  // exactly refused codes that were otherwise valid.
  const lines = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  if (lines[0]?.trim() !== 'BCD' || lines[3]?.trim() !== 'SCT') return null;

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

  const refRaw = (lines[9] || '').replace(/\s+/g, '').toUpperCase();
  const reference = refRaw && isValidRfReference(refRaw) ? refRaw : undefined;
  const description = (lines[10] || '').trim() || undefined;
  return { name, iban, amount, description, reference };
}
