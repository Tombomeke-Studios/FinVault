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
    '',
    (p.name || '').trim().slice(0, 70),
    normalizeIban(p.iban),
    amount,
    '',
    '',
    (p.description || '').trim().slice(0, 140),
  ].join('\n');
}

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
    if (!m) return null;
    amount = parseFloat(m[1]);
  }

  const description = (lines[10] || '').trim() || undefined;
  return { name, iban, amount, description };
}
