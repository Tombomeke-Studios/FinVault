import { describe, expect, it } from 'vitest';
import {
  MAX_SAVED_ACCOUNTS, accountStorageKey, findAccount, initialsOf, parseAccounts,
  removeAccount, updateAccount, upsertAccount, type SavedAccount,
} from './accounts';

const acct = (email: string, lastUsedAt: number, extra: Partial<SavedAccount> = {}): SavedAccount =>
  ({ email, name: email, initials: 'XX', biometric: false, lastUsedAt, ...extra });

describe('accountStorageKey', () => {
  it('only uses characters SecureStore accepts', () => {
    expect(accountStorageKey(' Tom+Bank@FinVault.com ')).toBe('tom_bank_finvault.com');
    expect(accountStorageKey('a@b.c')).toMatch(/^[A-Za-z0-9._-]+$/);
  });
});

describe('initialsOf', () => {
  it('uses first and last name, else the email', () => {
    expect(initialsOf('Tom van Bomeke', 'x@y.z')).toBe('TB');
    expect(initialsOf('Tom', 'x@y.z')).toBe('TO');
    expect(initialsOf('', 'admin@finvault.com')).toBe('AD');
  });
});

describe('upsertAccount', () => {
  it('adds a new account on top', () => {
    const list = upsertAccount([acct('a@x.com', 1)], { email: 'b@x.com', name: 'Bea Smit' }, 5);
    expect(list.map(a => a.email)).toEqual(['b@x.com', 'a@x.com']);
    expect(list[0]).toMatchObject({ initials: 'BS', biometric: false, lastUsedAt: 5 });
  });

  it('refreshes an existing account case-insensitively and keeps its biometric link', () => {
    const list = upsertAccount([acct('a@x.com', 1, { biometric: true }), acct('b@x.com', 2)], { email: 'A@X.com', name: 'Ann' }, 9);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ email: 'A@X.com', name: 'Ann', biometric: true, lastUsedAt: 9 });
  });

  it('keeps only the most recent accounts', () => {
    let list: SavedAccount[] = [];
    for (let i = 0; i < MAX_SAVED_ACCOUNTS + 2; i++) list = upsertAccount(list, { email: `u${i}@x.com` }, i);
    expect(list).toHaveLength(MAX_SAVED_ACCOUNTS);
    expect(list[0].email).toBe(`u${MAX_SAVED_ACCOUNTS + 1}@x.com`);
    expect(findAccount(list, 'u0@x.com')).toBeUndefined();
  });
});

describe('updateAccount / removeAccount', () => {
  it('changes fields without reordering', () => {
    const list = updateAccount([acct('a@x.com', 2), acct('b@x.com', 1)], 'B@x.com', { biometric: true });
    expect(list.map(a => [a.email, a.biometric])).toEqual([['a@x.com', false], ['b@x.com', true]]);
  });

  it('removes by email', () => {
    expect(removeAccount([acct('a@x.com', 2), acct('b@x.com', 1)], 'A@X.COM').map(a => a.email)).toEqual(['b@x.com']);
  });
});

describe('parseAccounts', () => {
  it('survives missing or corrupt data', () => {
    expect(parseAccounts(null)).toEqual([]);
    expect(parseAccounts('not json')).toEqual([]);
    expect(parseAccounts('{"a":1}')).toEqual([]);
  });

  it('drops invalid entries, fills defaults and sorts by recency', () => {
    const raw = JSON.stringify([
      { email: 'old@x.com', lastUsedAt: 1 },
      { nope: true },
      { email: 'new@x.com', name: 'New Person', biometric: true, lastUsedAt: 5 },
    ]);
    const list = parseAccounts(raw);
    expect(list.map(a => a.email)).toEqual(['new@x.com', 'old@x.com']);
    expect(list[0]).toMatchObject({ initials: 'NP', biometric: true });
    expect(list[1]).toMatchObject({ name: 'old@x.com', biometric: false });
  });
});
