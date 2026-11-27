import { describe, it, expect } from 'vitest';
import { normalizeIban, isValidIbanFormat, isValidIbanChecksum, generateBelgianIban } from './iban.js';
import { repairInvalidIbans, type IbanRepairClient } from './iban-repair.js';

describe('normalizeIban', () => {
  it('strips spaces and uppercases', () => {
    expect(normalizeIban('be89 3770 0771 9941')).toBe('BE89377007719941');
  });
  it('handles empty input', () => {
    expect(normalizeIban('')).toBe('');
  });
});

describe('isValidIbanFormat', () => {
  it('accepts a well-formed BE IBAN (with or without spaces)', () => {
    expect(isValidIbanFormat('BE89 3770 0771 9941')).toBe(true);
    expect(isValidIbanFormat('BE89377007719941')).toBe(true);
  });
  it('accepts seeded demo IBANs (random digits, correct structure)', () => {
    expect(isValidIbanFormat('BE8937700771123456'.slice(0, 16))).toBe(true);
  });
  it('enforces known country lengths', () => {
    expect(isValidIbanFormat('BE893770077199410')).toBe(false); // 17 chars, BE needs 16
    expect(isValidIbanFormat('NL91ABNA0417164300')).toBe(true); // 18 chars
  });
  it('rejects malformed input', () => {
    expect(isValidIbanFormat('1234')).toBe(false);
    expect(isValidIbanFormat('BEXX377007719941')).toBe(false);
    expect(isValidIbanFormat('lena@finvault.com')).toBe(false);
  });
});

describe('isValidIbanChecksum', () => {
  it('passes for real checksummed IBANs', () => {
    expect(isValidIbanChecksum('BE68 5390 0754 7034')).toBe(true);
    expect(isValidIbanChecksum('NL91 ABNA 0417 1643 00')).toBe(true);
  });
  it('fails when a digit is corrupted', () => {
    expect(isValidIbanChecksum('BE68 5390 0754 7035')).toBe(false);
  });
});

describe('generateBelgianIban (#98)', () => {
  it('issues a 16-character Belgian IBAN that passes the checksum, every time', () => {
    for (let i = 0; i < 500; i++) {
      const iban = generateBelgianIban();
      expect(iban).toMatch(/^BE\d{14}$/);
      expect(isValidIbanFormat(iban)).toBe(true);
      expect(isValidIbanChecksum(iban)).toBe(true);
    }
  });

  it('gets the national check digits right at the edges', () => {
    // The lowest and highest account numbers, and one whose remainder is 0 (written as 97).
    for (const r of [0, 0.9999999, 0.5, 0.1234567]) expect(isValidIbanChecksum(generateBelgianIban(() => r))).toBe(true);
    const zeroRemainder = Array.from({ length: 200 }, (_, i) => generateBelgianIban(() => i / 200)).filter((iban) => iban.endsWith('97'));
    for (const iban of zeroRemainder) expect(isValidIbanChecksum(iban)).toBe(true);
  });

  // What every wallet used to be given: a prefix and ten random digits.
  it('is not what the old generator produced', () => {
    expect(isValidIbanFormat('BE89377007711234567890')).toBe(false);
  });
});

describe('repairInvalidIbans (#98)', () => {
  function fakeClient(wallets: Array<{ id: string; iban: string }>, beneficiaries: Array<{ iban: string }>, scheduled: Array<{ targetIban: string }>) {
    const client: IbanRepairClient = {
      wallet: {
        findMany: async () => wallets.map((w) => ({ ...w })),
        update: async ({ where, data }) => void (wallets.find((w) => w.id === where.id)!.iban = data.iban),
      },
      beneficiary: {
        updateMany: async ({ where, data }) => {
          const hit = beneficiaries.filter((b) => b.iban === where.iban);
          for (const b of hit) b.iban = data.iban;
          return { count: hit.length };
        },
      },
      scheduledPayment: {
        updateMany: async ({ where, data }) => {
          const hit = scheduled.filter((p) => p.targetIban === where.targetIban);
          for (const p of hit) p.targetIban = data.targetIban;
          return { count: hit.length };
        },
      },
      $transaction: (work) => work(client),
    };
    return client;
  }

  const OLD = 'BE89377007711234567890';
  const GOOD = generateBelgianIban(() => 0.42);

  it('gives an invalid wallet a valid IBAN, and what pointed at the old one follows', async () => {
    const wallets = [{ id: 'w1', iban: OLD }, { id: 'w2', iban: GOOD }];
    const beneficiaries = [{ iban: OLD }, { iban: 'NL91ABNA0417164300' }];
    const scheduled = [{ targetIban: OLD }];
    const result = await repairInvalidIbans(fakeClient(wallets, beneficiaries, scheduled));

    expect(result).toEqual({ wallets: 1, beneficiaries: 1, scheduledPayments: 1 });
    expect(isValidIbanChecksum(wallets[0].iban)).toBe(true);
    expect(beneficiaries[0].iban).toBe(wallets[0].iban);
    expect(scheduled[0].targetIban).toBe(wallets[0].iban);
    // Untouched: a wallet that was fine, and somebody else's account at another bank.
    expect(wallets[1].iban).toBe(GOOD);
    expect(beneficiaries[1].iban).toBe('NL91ABNA0417164300');
  });

  it('does nothing the second time', async () => {
    const wallets = [{ id: 'w1', iban: OLD }];
    const client = fakeClient(wallets, [], []);
    await repairInvalidIbans(client);
    const after = wallets[0].iban;
    expect(await repairInvalidIbans(client)).toEqual({ wallets: 0, beneficiaries: 0, scheduledPayments: 0 });
    expect(wallets[0].iban).toBe(after);
  });

  it('never hands out a number another wallet already has', async () => {
    const wallets = [{ id: 'w1', iban: OLD }, { id: 'w2', iban: GOOD }];
    const offered = [GOOD, GOOD, generateBelgianIban(() => 0.77)];
    await repairInvalidIbans(fakeClient(wallets, [], []), () => offered.shift()!);
    expect(wallets[0].iban).not.toBe(GOOD);
    expect(isValidIbanChecksum(wallets[0].iban)).toBe(true);
  });
});
