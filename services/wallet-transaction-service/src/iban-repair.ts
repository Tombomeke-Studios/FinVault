import { generateBelgianIban, isValidIbanFormat } from './iban.js';

// Giving existing wallets a real IBAN (#98).
//
// Every account number used to be a 12-character prefix plus ten random digits:
// 22 characters where a Belgian IBAN has 16. FinVault's own validator rejected
// them, so no FinVault QR could be scanned and no transfer by IBAN to a FinVault
// account went through. New wallets get a valid IBAN from `generateBelgianIban`;
// this is for the ones that already exist.
//
// An account number changing is not nothing, so it is done once, per wallet, in
// a transaction that takes everything pointing at the old number along with it,
// and it says what it did.

/** The slice of the Prisma client this needs — so it can be pointed at any database, and faked in a test. */
export interface IbanRepairClient {
  wallet: {
    findMany(args: { select: { id: true; iban: true } }): Promise<Array<{ id: string; iban: string }>>;
    update(args: { where: { id: string }; data: { iban: string } }): Promise<unknown>;
  };
  beneficiary: { updateMany(args: { where: { iban: string }; data: { iban: string } }): Promise<{ count: number }> };
  scheduledPayment: { updateMany(args: { where: { targetIban: string }; data: { targetIban: string } }): Promise<{ count: number }> };
  $transaction<T>(work: (tx: IbanRepairClient) => Promise<T>): Promise<T>;
}

export interface IbanRepairResult {
  wallets: number;
  beneficiaries: number;
  scheduledPayments: number;
}

export async function repairInvalidIbans(client: IbanRepairClient, generate: () => string = generateBelgianIban): Promise<IbanRepairResult> {
  const result: IbanRepairResult = { wallets: 0, beneficiaries: 0, scheduledPayments: 0 };
  const wallets = await client.wallet.findMany({ select: { id: true, iban: true } });
  const taken = new Set(wallets.map((w) => w.iban));

  for (const wallet of wallets) {
    if (isValidIbanFormat(wallet.iban)) continue;

    let next = generate();
    // A billion possibilities, but the column is unique and a clash would abort the start-up.
    for (let attempt = 0; taken.has(next) && attempt < 20; attempt++) next = generate();
    if (taken.has(next)) throw new Error('could not find a free IBAN for a wallet');
    taken.add(next);

    await client.$transaction(async (tx) => {
      await tx.wallet.update({ where: { id: wallet.id }, data: { iban: next } });
      // Saved payees and standing orders that named the old number follow it —
      // otherwise they would point at an account that no longer exists.
      result.beneficiaries += (await tx.beneficiary.updateMany({ where: { iban: wallet.iban }, data: { iban: next } })).count;
      result.scheduledPayments += (await tx.scheduledPayment.updateMany({ where: { targetIban: wallet.iban }, data: { targetIban: next } })).count;
    });
    result.wallets++;
  }
  return result;
}
