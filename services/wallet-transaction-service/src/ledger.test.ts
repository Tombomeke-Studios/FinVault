import { describe, it, expect } from 'vitest';

// Simulating balance updates following double-entry rules
interface WalletState {
  id: string;
  balance: number;
}

function processDoubleEntryTransfer(
  sender: WalletState,
  receiver: WalletState,
  amount: number
): { senderAfter: number; receiverAfter: number; success: boolean; reason?: string } {
  if (amount <= 0) {
    return { senderAfter: sender.balance, receiverAfter: receiver.balance, success: false, reason: 'Invalid amount' };
  }
  if (sender.balance < amount) {
    return { senderAfter: sender.balance, receiverAfter: receiver.balance, success: false, reason: 'Insufficient funds' };
  }
  if (sender.id === receiver.id) {
    return { senderAfter: sender.balance, receiverAfter: receiver.balance, success: false, reason: 'Same account transfer' };
  }

  // Atomic ledger calculation
  return {
    senderAfter: sender.balance - amount,
    receiverAfter: receiver.balance + amount,
    success: true
  };
}

describe('Double-Entry Ledger Bookkeeping Logic', () => {
  it('should successfully transfer funds between two active wallets', () => {
    const sender = { id: 'wallet-sender', balance: 500.0 };
    const receiver = { id: 'wallet-receiver', balance: 100.0 };
    const amount = 150.0;

    const result = processDoubleEntryTransfer(sender, receiver, amount);

    expect(result.success).toBe(true);
    expect(result.senderAfter).toBe(350.0);
    expect(result.receiverAfter).toBe(250.0);
    // Double entry verification: total assets in system must remain constant
    const totalBefore = sender.balance + receiver.balance;
    const totalAfter = result.senderAfter + result.receiverAfter;
    expect(totalBefore).toEqual(totalAfter);
  });

  it('should reject transfers with insufficient funds', () => {
    const sender = { id: 'wallet-sender', balance: 50.0 };
    const receiver = { id: 'wallet-receiver', balance: 100.0 };
    const amount = 150.0;

    const result = processDoubleEntryTransfer(sender, receiver, amount);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('Insufficient funds');
    expect(result.senderAfter).toBe(50.0);
    expect(result.receiverAfter).toBe(100.0);
  });

  it('should prevent transfer to self', () => {
    const sender = { id: 'wallet-same', balance: 200.0 };
    const receiver = { id: 'wallet-same', balance: 200.0 };
    const amount = 50.0;

    const result = processDoubleEntryTransfer(sender, receiver, amount);

    expect(result.success).toBe(false);
    expect(result.reason).toBe('Same account transfer');
  });
});
