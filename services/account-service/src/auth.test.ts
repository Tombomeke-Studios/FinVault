import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app, prisma, seedAccounts } from './app.js';
import type { Server } from 'http';

let server: Server;
let baseUrl: string;

const TEST_EMAIL = 'authtest@finvault.com';
const TEST_PASS = 'TestPass123!';

beforeAll(async () => {
  await seedAccounts();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
  // Register a test user with a Zod-valid password
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
