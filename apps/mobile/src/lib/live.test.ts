import { describe, it, expect } from 'vitest';
import { liveAction, liveSocketUrl, reconnectDelayMs, withBalance } from './live';

describe('liveSocketUrl', () => {
  it('keeps host and port and swaps the scheme', () => {
    expect(liveSocketUrl('http://192.168.0.117:8000', 'abc')).toBe('ws://192.168.0.117:8000/?token=abc');
    expect(liveSocketUrl('https://api.finvault.example', 'abc')).toBe('wss://api.finvault.example/?token=abc');
  });

  it('drops any path and encodes the token', () => {
    expect(liveSocketUrl('http://host:8000/api/', 'a+b/c=')).toBe('ws://host:8000/?token=a%2Bb%2Fc%3D');
  });

  it('refuses what it cannot turn into an address', () => {
    expect(liveSocketUrl('', 'abc')).toBeNull();
    expect(liveSocketUrl('ftp://host', 'abc')).toBeNull();
    expect(liveSocketUrl('http://host:8000', '')).toBeNull();
  });
});

describe('liveAction', () => {
  const msg = (type: string, payload: unknown) => JSON.stringify({ event: { type, payload } });

  it('turns balance.updated into that wallet’s new balance', () => {
    expect(liveAction(msg('balance.updated', { walletId: 'w1', userId: 'u1', balance: 12.5, currency: 'EUR' })))
      .toEqual({ kind: 'balance', walletId: 'w1', balance: 12.5 });
  });

  it('reloads on payment.confirmed, without carrying anything from it', () => {
    expect(liveAction(msg('payment.confirmed', { reference: 'TX-1', amount: 10 }))).toEqual({ kind: 'reload' });
  });

  it('ignores a malformed balance rather than showing a wrong one', () => {
    expect(liveAction(msg('balance.updated', { walletId: 'w1', balance: '12.50' }))).toBeNull();
    expect(liveAction(msg('balance.updated', { balance: 12.5 }))).toBeNull();
    expect(liveAction(msg('balance.updated', { walletId: 'w1', balance: NaN }))).toBeNull();
  });

  it('ignores other events, non-JSON and non-strings', () => {
    expect(liveAction(msg('balance.low', { walletId: 'w1', balance: 1 }))).toBeNull();
    expect(liveAction('not json')).toBeNull();
    expect(liveAction(undefined)).toBeNull();
  });
});

describe('withBalance', () => {
  const wallets = [{ id: 'w1', balance: 10, type: 'checking' }, { id: 'w2', balance: 5, type: 'savings' }];

  it('replaces one wallet’s balance and keeps the rest', () => {
    expect(withBalance(wallets, 'w2', 7)).toEqual([{ id: 'w1', balance: 10, type: 'checking' }, { id: 'w2', balance: 7, type: 'savings' }]);
  });

  it('returns the same array for a wallet that is not this user’s', () => {
    expect(withBalance(wallets, 'someone-else', 7)).toBe(wallets);
  });
});

describe('reconnectDelayMs', () => {
  it('doubles from one second and stops at thirty', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(reconnectDelayMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });
});
