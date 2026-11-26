import { describe, it, expect } from 'vitest';
import { recipientsOf } from './ws-routing.js';

describe('recipientsOf (#108)', () => {
  it('sends a balance update to its own user only', () => {
    expect(recipientsOf({ type: 'balance.updated', payload: { walletId: 'w1', userId: 'u1', balance: 5 } })).toEqual(['u1']);
    expect(recipientsOf({ type: 'balance.low', payload: { userId: 'u1' } })).toEqual(['u1']);
  });

  it('sends a payment to its sender and its receiver, and nobody else', () => {
    const event = { type: 'payment.confirmed', payload: { reference: 'TX-1', amount: 10, senderUserId: 'u1', receiverUserId: 'u2' } };
    expect(recipientsOf(event)).toEqual(['u1', 'u2']);
  });

  it('names a user once when they paid themselves', () => {
    expect(recipientsOf({ type: 'payment.confirmed', payload: { senderUserId: 'u1', receiverUserId: 'u1' } })).toEqual(['u1']);
  });

  it('sends a payment that names no user to nobody', () => {
    // The invoice service's answers to NexusInfra carry only the requester's reference.
    expect(recipientsOf({ type: 'payment.confirmed', payload: { reference: 'topup_1', amount: 10 } })).toEqual([]);
    expect(recipientsOf({ type: 'payment.failed', payload: { reference: 'topup_1', reason: 'declined' } })).toEqual([]);
  });

  it('sends unknown event types to nobody, even when they carry a userId', () => {
    // invoice.generate carries a NexusInfra user id, which means nothing here.
    expect(recipientsOf({ type: 'invoice.generate', payload: { userId: 'u1' } })).toEqual([]);
    expect(recipientsOf({ type: 'account.created', payload: { userId: 'u1' } })).toEqual([]);
  });

  it('ignores ids that are not strings', () => {
    expect(recipientsOf({ type: 'payment.confirmed', payload: { senderUserId: 42, receiverUserId: '' } })).toEqual([]);
    expect(recipientsOf({ type: 'balance.updated' })).toEqual([]);
  });
});
