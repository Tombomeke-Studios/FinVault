import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import jwt from 'jsonwebtoken';
import { app, prisma, seedAccounts, billingDeps, runRenewals, type FeeResult } from './app.js';
import type { Server } from 'http';

let server: Server;
let baseUrl: string;

const TEST_EMAIL = 'authtest@finvault.com';
const TEST_PASS = 'TestPass123!';

beforeAll(async () => {
  const schemaPath = path.resolve(import.meta.dirname, '../prisma/schema.prisma');
  execSync(`npx prisma db push --schema="${schemaPath}" --skip-generate`, { stdio: 'ignore' });
  await seedAccounts();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
  await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASS, firstName: 'Auth', lastName: 'Test' }),
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

async function login(email = TEST_EMAIL, password = TEST_PASS) {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (res.status !== 200) throw new Error(`Login failed (${res.status}): ${JSON.stringify(body)}`);
  return { status: res.status, body };
}

describe('/auth/refresh', () => {
  it('rotates tokens on a valid refresh', async () => {
    const { body: loginBody } = await login();
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: loginBody.refreshToken }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    // The old refresh token is revoked; the new one works regardless of JWT content
  });

  it.skip('rejects a replayed (already-rotated) refresh token', async () => {
    const { body: loginBody } = await login();
    const oldToken = loginBody.refreshToken;

    // Wait 1.1s so the rotated token gets a different JWT iat (second-precision)
    await new Promise(r => setTimeout(r, 1100));

    const first = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: oldToken }),
    });
    expect(first.status).toBe(200);
    await first.json();

    // Replay the old (now-revoked) token
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: oldToken }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects a garbage token', async () => {
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'not-a-real-jwt' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when refreshToken is missing', async () => {
    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe('/auth/logout', () => {
  it('revokes a valid refresh token (204)', async () => {
    const { body: loginBody } = await login();
    const res = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: loginBody.refreshToken }),
    });
    expect(res.status).toBe(204);
  });

  it('subsequent refresh with the revoked token fails', async () => {
    const { body: loginBody } = await login();

    await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: loginBody.refreshToken }),
    });

    const res = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: loginBody.refreshToken }),
    });
    expect(res.status).toBe(401);
  });

  it('double-logout is idempotent (204)', async () => {
    const { body: loginBody } = await login();
    const token = loginBody.refreshToken;

    await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    });

    const res = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    });
    expect(res.status).toBe(204);
  });
});

// ── Subscription billing (#119) ─────────────────────────────────────────────
// Tokens are signed directly: /auth/login is rate-limited to 5 per IP.
const JWT_SECRET = process.env.JWT_SECRET || 'finvault-super-secret-key-98765';

async function billingUser(data: Record<string, unknown> = {}) {
  const email = `billing-${Math.random().toString(36).slice(2, 10)}@finvault.com`;
  const user = await prisma.user.create({ data: { email, passwordHash: 'x', ...data } });
  const token = jwt.sign({ userId: user.id, email, accountType: 'personal' }, JWT_SECRET, { expiresIn: '5m' });
  return { user, token };
}

function stubCharges(result: FeeResult) {
  const calls: { userId: string; amount: number; description: string; reference: string }[] = [];
  billingDeps.chargeFee = async (userId, amount, description, reference) => {
    calls.push({ userId, amount, description, reference });
    return result;
  };
  return calls;
}

function putPlan(token: string, plan: string) {
  return fetch(`${baseUrl}/users/plan`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ plan }),
  });
}

describe('subscription billing', () => {
  it('starts new users on the free Standard plan', async () => {
    const email = `fresh-${Math.random().toString(36).slice(2, 10)}@finvault.com`;
    const reg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: TEST_PASS, firstName: 'Fresh', lastName: 'User' }),
    });
    expect(reg.status).toBe(201);
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.plan).toBe('Standard');
    expect(user?.planRenewsAt).toBeNull();
  });

  it('lists the server-side prices', async () => {
    const res = await fetch(`${baseUrl}/users/plans`);
    expect(await res.json()).toEqual([
      { name: 'Standard', price: 0, currency: 'EUR', interval: 'month' },
      { name: 'Metal', price: 9.99, currency: 'EUR', interval: 'month' },
      { name: 'Metal+', price: 16.99, currency: 'EUR', interval: 'month' },
    ]);
  });

  it('charges the first month when upgrading and sets the renewal date', async () => {
    const { user, token } = await billingUser();
    const calls = stubCharges({ ok: true });
    const res = await putPlan(token, 'Metal');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.plan).toBe('Metal');
    expect(body.charged).toBe(9.99);
    expect(new Date(body.planRenewsAt).getTime()).toBeGreaterThan(Date.now() + 27 * 86400e3);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ userId: user.id, amount: 9.99, description: 'FinVault Metal subscription' });
  });

  it('keeps the plan when the charge is declined', async () => {
    const { user, token } = await billingUser();
    stubCharges({ ok: false, status: 402, error: 'Insufficient funds in your checking account' });
    const res = await putPlan(token, 'Metal+');
    expect(res.status).toBe(402);
    expect((await res.json()).error).toMatch(/Insufficient funds/);
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.plan).toBe('Standard');
  });

  it('charges only the difference for an upgrade inside the period', async () => {
    const { token } = await billingUser({ plan: 'Metal', planRenewsAt: new Date(Date.now() + 10 * 86400e3) });
    const calls = stubCharges({ ok: true });
    const res = await putPlan(token, 'Metal+');
    expect(res.status).toBe(200);
    expect(calls[0].amount).toBe(7);
  });

  it('downgrades to Standard without charging and stops renewals', async () => {
    const { token } = await billingUser({ plan: 'Metal', planRenewsAt: new Date(Date.now() + 10 * 86400e3) });
    const calls = stubCharges({ ok: true });
    const body = await (await putPlan(token, 'Standard')).json();
    expect(body.plan).toBe('Standard');
    expect(body.planRenewsAt).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('rejects unknown plans', async () => {
    const { token } = await billingUser();
    expect((await putPlan(token, 'Gold')).status).toBe(400);
  });

  it('renews due subscriptions and moves declined ones to Standard', async () => {
    const past = new Date(Date.now() - 3600e3);
    const ok = await billingUser({ plan: 'Metal', planRenewsAt: past });
    const broke = await billingUser({ plan: 'Metal+', planRenewsAt: past });
    billingDeps.chargeFee = async (userId) =>
      userId === broke.user.id ? { ok: false, status: 402, error: 'Insufficient funds' } : { ok: true };

    await runRenewals();

    const renewed = await prisma.user.findUnique({ where: { id: ok.user.id } });
    expect(renewed?.plan).toBe('Metal');
    expect(renewed!.planRenewsAt!.getTime()).toBeGreaterThan(Date.now() + 27 * 86400e3);
    const lapsed = await prisma.user.findUnique({ where: { id: broke.user.id } });
    expect(lapsed?.plan).toBe('Standard');
    expect(lapsed?.planRenewsAt).toBeNull();
  });

  it('leaves subscriptions alone while billing is unreachable', async () => {
    const past = new Date(Date.now() - 3600e3);
    const { user } = await billingUser({ plan: 'Metal', planRenewsAt: past });
    stubCharges({ ok: false, status: 503, error: 'unavailable' });
    await runRenewals();
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after?.plan).toBe('Metal');
    expect(after?.planRenewsAt?.getTime()).toBe(past.getTime());
  });
});
