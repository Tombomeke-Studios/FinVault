import { describe, it, expect } from 'vitest';
import { LoginSchema, RegisterSchema } from './validation.js';

describe('LoginSchema', () => {
  // #92: the seeded demo customer has a 7-character password. Login applied the
  // registration length rule, so the request was rejected before the password
  // was ever compared — the account could not sign in at all.
  it('does not apply the registration rules to a password that already exists', () => {
    expect(LoginSchema.safeParse({ email: 'test@finvault.com', password: 'test123' }).success).toBe(true);
  });

  it('still wants an email and some password', () => {
    expect(LoginSchema.safeParse({ email: 'test@finvault.com', password: '' }).success).toBe(false);
    expect(LoginSchema.safeParse({ email: 'not-an-email', password: 'whatever' }).success).toBe(false);
    expect(LoginSchema.safeParse({ email: 'test@finvault.com', password: 'x'.repeat(129) }).success).toBe(false);
  });
});

describe('RegisterSchema', () => {
  it('keeps its password rules for new accounts', () => {
    const base = { email: 'new@example.com', firstName: 'New', lastName: 'User' };
    expect(RegisterSchema.safeParse({ ...base, password: 'test123' }).success).toBe(false);
    expect(RegisterSchema.safeParse({ ...base, password: 'Long-Enough-1' }).success).toBe(true);
  });
});
