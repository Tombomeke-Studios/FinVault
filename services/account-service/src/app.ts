
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import { PrismaClient } from '../generated/prisma/index.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { TOTP, generateSecret, generateURI } from 'otplib';
import QRCode from 'qrcode';
import { publishEvent, validateBody, LoginSchema, RegisterSchema, requireServiceSecret, getServiceSecret } from 'shared';
import { PLAN_PRICES, addOneMonth, chargeReference, isPlanName, planChange, planPrice } from './billing.js';

export const prisma = new PrismaClient();
const totp = new TOTP();
export const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'finvault-super-secret-key-98765';
const BCRYPT_ROUNDS = 12;

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const REFRESH_TOKEN_DAYS = 7;

async function issueTokenPair(user: { id: string; email: string; accountType: string }) {
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, accountType: user.accountType },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const refreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: `${REFRESH_TOKEN_DAYS}d` });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt }
  });

  return { accessToken, refreshToken };
}

app.use(helmet());
app.use(cors());
app.use(express.json());

// =============================================
// Rate Limiting & Account Lockout Setup
// =============================================
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const registerAttempts = new Map<string, { count: number; resetAt: number }>();
const biometricAttempts = new Map<string, { count: number; resetAt: number }>();
const failedLoginAttemptsByEmail = new Map<string, number>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of loginAttempts) if (now > v.resetAt) loginAttempts.delete(k);
  for (const [k, v] of registerAttempts) if (now > v.resetAt) registerAttempts.delete(k);
  for (const [k, v] of biometricAttempts) if (now > v.resetAt) biometricAttempts.delete(k);
  prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(err => console.error('Refresh-token cleanup failed:', err));
}, 15 * 60 * 1000).unref();

function checkRateLimit(
  ip: string,
  map: Map<string, { count: number; resetAt: number }>,
  maxCount: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = map.get(ip);

  if (!record || now > record.resetAt) {
    const newRecord = { count: 1, resetAt: now + windowMs };
    map.set(ip, newRecord);
    return { allowed: true, remaining: maxCount - 1, resetAt: newRecord.resetAt };
  }

  if (record.count >= maxCount) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count += 1;
  return { allowed: true, remaining: maxCount - record.count, resetAt: record.resetAt };
}


const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    (req as any).user = user;
    next();
  });
};

async function logAudit(userId: string | null, action: string, req: express.Request) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'unknown'
      }
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

app.post('/auth/register', async (req, res) => {
  const ip = req.ip || '127.0.0.1';
  const limitRes = checkRateLimit(ip, registerAttempts, 3, 60 * 60 * 1000);
  if (!limitRes.allowed) {
    return res.status(429).json({
      error: 'Too many account registrations. Please try again in 1 hour.',
      resetAt: limitRes.resetAt
    });
  }

  const body = validateBody(RegisterSchema, req, res);
  if (!body) return;

  const { email, password, firstName, lastName, dateOfBirth, address, country, accountType } = body;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        accountType: accountType || 'personal',
        profile: {
          create: {
            firstName,
            lastName,
            dateOfBirth: dateOfBirth || '',
            address: address || '',
            country: country || ''
          }
        }
      },
      include: { profile: true }
    });

    console.log(`[AccountService] User registered: ${user.email}`);

    await publishEvent('account-service', {
      type: 'account.created',
      payload: {
        userId: user.id,
        email: user.email,
        accountType: user.accountType
      }
    }, process.env.GATEWAY_URL);

    await logAudit(user.id, 'Account registration completed', req);

    res.status(201).json({
      message: 'User successfully registered',
      user: {
        id: user.id,
        email: user.email,
        accountType: user.accountType,
        profile: user.profile
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', message: error.message });
  }
});

app.post('/auth/login', async (req, res) => {
  const ip = req.ip || '127.0.0.1';
  const limitRes = checkRateLimit(ip, loginAttempts, 5, 15 * 60 * 1000);
  if (!limitRes.allowed) {
    return res.status(429).json({
      error: 'Too many login attempts. Please try again in 15 minutes.',
      resetAt: limitRes.resetAt
    });
  }

  const body = validateBody(LoginSchema, req, res);
  if (!body) return;

  const { email, password } = body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true }
    });

    if (!user) {
      await logAudit(null, `Failed login attempt (non-existent email): ${email}`, req);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status === 'frozen') {
      await logAudit(user.id, 'Blocked login attempt on frozen account', req);
      return res.status(403).json({ error: 'Account has been frozen' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const attempts = (failedLoginAttemptsByEmail.get(email) || 0) + 1;
      failedLoginAttemptsByEmail.set(email, attempts);

      if (attempts >= 10) {
        await prisma.user.update({
          where: { id: user.id },
          data: { status: 'frozen' }
        });
        await logAudit(user.id, 'Account frozen due to too many failed login attempts', req);

        await publishEvent('account-service', {
          type: 'account.frozen',
          payload: {
            userId: user.id,
            reason: 'Too many failed login attempts'
          }
        }, process.env.GATEWAY_URL);

        failedLoginAttemptsByEmail.delete(email);
        return res.status(403).json({ error: 'Account has been frozen due to 10 failed login attempts.' });
      }

      await logAudit(user.id, `Failed login attempt ${attempts}/10 for email: ${email}`, req);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    failedLoginAttemptsByEmail.delete(email);

    if (user.totpEnabled) {
      const tempToken = jwt.sign({ userId: user.id, pending2FA: true }, JWT_SECRET, { expiresIn: '5m' });
      await logAudit(user.id, 'Login requires 2FA verification', req);
      return res.status(200).json({ requires2FA: true, tempToken });
    }

    const { accessToken, refreshToken } = await issueTokenPair(user);

    await logAudit(user.id, 'User login successful', req);

    res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        accountType: user.accountType,
        profile: user.profile || undefined
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', message: error.message });
  }
});

app.post('/auth/verify-2fa', async (req, res) => {
  const { tempToken, code } = req.body || {};
  if (!tempToken || !code) return res.status(400).json({ error: 'tempToken and code are required' });

  try {
    let decoded: any;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Expired or invalid token — please log in again' });
    }
    if (!decoded.pending2FA) return res.status(400).json({ error: 'Invalid token type' });

    const user = await prisma.user.findUnique({ where: { id: decoded.userId }, include: { profile: true } });
    if (!user || !user.totpSecret) return res.status(400).json({ error: 'User not found' });

    const valid = new TOTP({ secret: user.totpSecret }).verify(code);
    if (!valid) {
      await logAudit(user.id, 'Failed 2FA attempt', req);
      return res.status(401).json({ error: 'Invalid 2FA code' });
    }

    const { accessToken, refreshToken } = await issueTokenPair(user);
    await logAudit(user.id, 'User login successful (2FA verified)', req);

    res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        accountType: user.accountType,
        profile: user.profile || undefined
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: '2FA verification failed', message: error.message });
  }
});

// =============================================
// Biometric sign-in (#120)
// =============================================
// No server (or app) ever sees a fingerprint or a face: Android and iOS keep the
// biometric templates and only tell the app "the enrolled owner passed". So the
// account is bound to the *phone*: enrolling (while signed in) issues a random
// device secret, the app stores it in the hardware keystore behind the OS
// biometric prompt, and signing in presents it. We keep only its SHA-256.
const MAX_BIOMETRIC_DEVICES = 10;

function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex'), y = Buffer.from(b, 'hex');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

app.post('/auth/biometric/enroll', authenticateToken, async (req, res) => {
  const tokenUser = (req as any).user;
  const name = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim().slice(0, 60) : 'Phone';
  try {
    const count = await prisma.biometricDevice.count({ where: { userId: tokenUser.userId } });
    if (count >= MAX_BIOMETRIC_DEVICES) {
      return res.status(409).json({ error: `At most ${MAX_BIOMETRIC_DEVICES} devices can use biometric sign-in. Remove one first.` });
    }
    const secret = crypto.randomBytes(32).toString('base64url');
    const device = await prisma.biometricDevice.create({
      data: { userId: tokenUser.userId, name, secretHash: hashToken(secret) },
    });
    await logAudit(tokenUser.userId, `Biometric sign-in enabled on ${name}`, req);
    // The secret is returned exactly once.
    res.status(201).json({ deviceId: device.id, secret });
  } catch (error: any) {
    res.status(500).json({ error: 'Could not enable biometric sign-in' });
  }
});

app.post('/auth/biometric/login', async (req, res) => {
  const ip = req.ip || '127.0.0.1';
  const limit = checkRateLimit(ip, biometricAttempts, 10, 15 * 60 * 1000);
  if (!limit.allowed) {
    return res.status(429).json({ error: 'Too many sign-in attempts. Please try again in 15 minutes.', resetAt: limit.resetAt });
  }

  const { deviceId, secret } = req.body || {};
  if (typeof deviceId !== 'string' || typeof secret !== 'string' || !deviceId || !secret) {
    return res.status(400).json({ error: 'deviceId and secret are required' });
  }

  try {
    const device = await prisma.biometricDevice.findUnique({ where: { id: deviceId } });
    // Same answer for "no such device" and "wrong secret".
    if (!device || !sameHash(device.secretHash, hashToken(secret))) {
      await logAudit(device?.userId ?? null, 'Failed biometric sign-in (unknown device or bad credential)', req);
      return res.status(401).json({ error: 'Biometric sign-in is no longer set up for this account. Sign in with your password.' });
    }

    const user = await prisma.user.findUnique({ where: { id: device.userId }, include: { profile: true } });
    if (!user) return res.status(401).json({ error: 'Biometric sign-in is no longer set up for this account. Sign in with your password.' });
    if (user.status === 'frozen') {
      await logAudit(user.id, 'Blocked biometric sign-in on frozen account', req);
      return res.status(403).json({ error: 'Account has been frozen' });
    }

    await prisma.biometricDevice.update({ where: { id: device.id }, data: { lastUsedAt: new Date() } });
    const { accessToken, refreshToken } = await issueTokenPair(user);
    await logAudit(user.id, `Biometric sign-in on ${device.name}`, req);

    res.status(200).json({
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, accountType: user.accountType, profile: user.profile || undefined },
    });
  } catch (error: any) {
    console.error('Biometric login error:', error);
    res.status(500).json({ error: 'Biometric sign-in failed' });
  }
});

app.get('/users/biometric-devices', authenticateToken, async (req, res) => {
  const tokenUser = (req as any).user;
  const devices = await prisma.biometricDevice.findMany({
    where: { userId: tokenUser.userId },
    select: { id: true, name: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(devices);
});

app.delete('/users/biometric-devices/:id', authenticateToken, async (req, res) => {
  const tokenUser = (req as any).user;
  const result = await prisma.biometricDevice.deleteMany({ where: { id: req.params.id, userId: tokenUser.userId } });
  if (result.count === 0) return res.status(404).json({ error: 'Device not found' });
  await logAudit(tokenUser.userId, 'Biometric sign-in removed from a device', req);
  res.status(204).end();
});

app.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken || typeof refreshToken !== 'string') {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  try {
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const stored = await prisma.refreshToken.findFirst({
      where: {
        tokenHash: hashToken(refreshToken),
        userId: decoded.userId,
        revoked: false,
        expiresAt: { gt: new Date() }
      }
    });
    if (!stored) {
      await prisma.refreshToken.updateMany({ where: { userId: decoded.userId }, data: { revoked: true } });
      await logAudit(decoded.userId, 'Refresh token reuse detected — all sessions revoked', req);
      return res.status(401).json({ error: 'Refresh token no longer valid. Please sign in again.' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || user.status === 'frozen') {
      return res.status(403).json({ error: 'Account unavailable' });
    }

    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });
    const pair = await issueTokenPair(user);

    await logAudit(user.id, 'Session refreshed (token rotation)', req);
    res.status(200).json(pair);
  } catch (error: any) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

app.post('/auth/logout', async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken || typeof refreshToken !== 'string') {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  try {
    const result = await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revoked: false },
      data: { revoked: true }
    });
    if (result.count > 0) {
      try {
        const decoded: any = jwt.decode(refreshToken);
        if (decoded?.userId) await logAudit(decoded.userId, 'User signed out (refresh token revoked)', req);
      } catch { /* audit best-effort */ }
    }
    res.status(204).end();
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

app.get('/users/profile', authenticateToken, async (req, res) => {
  const tokenUser = (req as any).user;

  try {
    const user = await prisma.user.findUnique({
      where: { id: tokenUser.userId },
      include: { profile: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(profileJson(user));
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve profile', message: error.message });
  }
});

// =============================================
// Subscription billing (#119)
// =============================================
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:8002';

export type FeeResult = { ok: true } | { ok: false; status: number; error: string };

/** Debits a subscription fee via wallet-service. Replaceable in tests. */
export const billingDeps = {
  async chargeFee(userId: string, amount: number, description: string, reference: string): Promise<FeeResult> {
    try {
      const r = await fetch(`${WALLET_SERVICE_URL}/transactions/internal-fee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Service-Secret': getServiceSecret() },
        body: JSON.stringify({ userId, amount, description, reference }),
      });
      if (r.ok) return { ok: true };
      const body: any = await r.json().catch(() => ({}));
      return { ok: false, status: r.status, error: body.error || 'The charge was declined' };
    } catch {
      return { ok: false, status: 503, error: 'Billing is temporarily unavailable. Try again in a moment.' };
    }
  },
};

function profileJson(user: any) {
  return {
    id: user.id,
    email: user.email,
    accountType: user.accountType,
    status: user.status,
    plan: user.plan,
    planPrice: planPrice(user.plan),
    planRenewsAt: user.planRenewsAt,
    profile: user.profile,
    createdAt: user.createdAt,
  };
}

app.get('/users/plans', (_req, res) => {
  res.json(Object.entries(PLAN_PRICES).map(([name, price]) => ({ name, price, currency: 'EUR', interval: 'month' })));
});

app.put('/users/plan', authenticateToken, async (req, res) => {
  const tokenUser = (req as any).user;
  const { plan } = req.body || {};

  if (!isPlanName(plan)) {
    return res.status(400).json({ error: 'Invalid plan selected' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: tokenUser.userId }, include: { profile: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.plan === plan) return res.status(200).json({ ...profileJson(user), charged: 0 });

    const now = new Date();
    const change = planChange(user.plan, plan, user.planRenewsAt, now);

    if (change.charge > 0) {
      const kind = change.renewsAt === user.planRenewsAt ? 'upgrade' : 'start';
      const description = kind === 'upgrade'
        ? `FinVault ${plan} upgrade (rest of this period)`
        : `FinVault ${plan} subscription`;
      const result = await billingDeps.chargeFee(user.id, change.charge, description, chargeReference(user.id, kind, plan, now));
      if (!result.ok) {
        await logAudit(user.id, `Plan change to ${plan} declined: ${result.error}`, req);
        return res.status(result.status === 503 ? 503 : 402).json({ error: result.error, amount: change.charge });
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { plan, planRenewsAt: change.renewsAt },
      include: { profile: true },
    });
    await logAudit(user.id, `Plan changed ${user.plan} → ${plan}${change.charge > 0 ? ` (charged €${change.charge.toFixed(2)})` : ''}`, req);

    res.status(200).json({ ...profileJson(updated), charged: change.charge });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update plan', message: error.message });
  }
});

/**
 * Bills every subscription whose period ended. A declined charge (no funds, no
 * account) moves the customer to Standard; an unreachable wallet service leaves
 * the subscription alone so the next run retries. Started from index.ts.
 */
export async function runRenewals(now = new Date()): Promise<{ renewed: number; downgraded: number }> {
  const due = await prisma.user.findMany({ where: { planRenewsAt: { lte: now }, plan: { not: 'Standard' } } });
  let renewed = 0, downgraded = 0;
  for (const user of due) {
    if (!isPlanName(user.plan) || !user.planRenewsAt) continue;
    const price = planPrice(user.plan);
    const result = await billingDeps.chargeFee(user.id, price, `FinVault ${user.plan} subscription`,
      chargeReference(user.id, 'renewal', user.plan, user.planRenewsAt));
    if (result.ok) {
      let next = addOneMonth(user.planRenewsAt);
      if (next.getTime() <= now.getTime()) next = addOneMonth(now); // service was down for over a month
      await prisma.user.update({ where: { id: user.id }, data: { planRenewsAt: next } });
      await prisma.auditLog.create({ data: { userId: user.id, action: `Subscription renewed: ${user.plan} (€${price.toFixed(2)})`, ipAddress: 'system', userAgent: 'billing' } });
      renewed++;
    } else if (result.status !== 503) {
      await prisma.user.update({ where: { id: user.id }, data: { plan: 'Standard', planRenewsAt: null } });
      await prisma.auditLog.create({ data: { userId: user.id, action: `Subscription ended, moved to Standard: ${result.error}`, ipAddress: 'system', userAgent: 'billing' } });
      downgraded++;
    }
  }
  return { renewed, downgraded };
}

app.get('/users/profile-by-email', requireServiceSecret, async (req, res) => {
  const email = req.query.email as string;
  if (!email) {
    return res.status(400).json({ error: 'Email parameter required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({
      id: user.id,
      email: user.email,
      accountType: user.accountType,
      profile: user.profile
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed lookup', message: error.message });
  }
});

app.get('/users/audit-logs', authenticateToken, async (req, res) => {
  const tokenUser = (req as any).user;

  try {
    const logs = await prisma.auditLog.findMany({
      where: { userId: tokenUser.userId },
      orderBy: { timestamp: 'desc' },
      take: 50
    });

    res.status(200).json(logs);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve audit logs', message: error.message });
  }
});

app.post('/users/change-password', authenticateToken, async (req, res) => {
  const tokenUser = (req as any).user;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: tokenUser.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect' });

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revoked: false },
      data: { revoked: true }
    });

    // Enrolled phones are bound to the old credentials too: they re-enroll after
    // the next password sign-in (#120).
    await prisma.biometricDevice.deleteMany({ where: { userId: user.id } });

    await logAudit(user.id, 'Password changed — all sessions and biometric devices revoked', req);

    const pair = await issueTokenPair(user);
    res.status(200).json({ message: 'Password changed successfully', ...pair });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to change password', message: error.message });
  }
});

app.get('/users/sessions', authenticateToken, async (req, res) => {
  const tokenUser = (req as any).user;
  try {
    const tokens = await prisma.refreshToken.findMany({
      where: { userId: tokenUser.userId, revoked: false, expiresAt: { gt: new Date() } },
      select: { id: true, expiresAt: true },
      orderBy: { expiresAt: 'desc' }
    });
    res.status(200).json(tokens.map(t => ({ id: t.id, expiresAt: t.expiresAt })));
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve sessions', message: error.message });
  }
});

app.delete('/users/sessions/:id', authenticateToken, async (req, res) => {
  const tokenUser = (req as any).user;
  const { id } = req.params;
  try {
    const token = await prisma.refreshToken.findUnique({ where: { id } });
    if (!token || token.userId !== tokenUser.userId) {
      return res.status(404).json({ error: 'Session not found' });
    }
    await prisma.refreshToken.update({ where: { id }, data: { revoked: true } });
    await logAudit(tokenUser.userId, 'Session revoked manually', req);
    res.status(200).json({ status: 'revoked' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to revoke session', message: error.message });
  }
});

// =============================================
// TOTP 2FA
// =============================================
app.post('/users/2fa/setup', authenticateToken, async (req, res) => {
  const tokenUser = (req as any).user;
  try {
    const user = await prisma.user.findUnique({ where: { id: tokenUser.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.totpEnabled) return res.status(400).json({ error: '2FA is already enabled' });

    const secret = generateSecret();
    await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret } });

    const otpauth = generateURI({ issuer: 'FinVault', label: user.email, secret });
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    await logAudit(user.id, '2FA setup initiated', req);
    res.status(200).json({ secret, otpauth, qrDataUrl });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to setup 2FA', message: error.message });
  }
});

app.post('/users/2fa/verify', authenticateToken, async (req, res) => {
  const tokenUser = (req as any).user;
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code is required' });

  try {
    const user = await prisma.user.findUnique({ where: { id: tokenUser.userId } });
    if (!user || !user.totpSecret) return res.status(400).json({ error: '2FA not set up' });

    const valid = new TOTP({ secret: user.totpSecret }).verify(code);
    if (!valid) return res.status(401).json({ error: 'Invalid code' });

    await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
    await logAudit(user.id, '2FA enabled successfully', req);
    res.status(200).json({ enabled: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to verify 2FA', message: error.message });
  }
});

app.post('/users/2fa/disable', authenticateToken, async (req, res) => {
  const tokenUser = (req as any).user;
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code is required' });

  try {
    const user = await prisma.user.findUnique({ where: { id: tokenUser.userId } });
    if (!user || !user.totpEnabled || !user.totpSecret) return res.status(400).json({ error: '2FA is not enabled' });

    const valid = new TOTP({ secret: user.totpSecret }).verify(code);
    if (!valid) return res.status(401).json({ error: 'Invalid code' });

    await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: false, totpSecret: null } });
    await logAudit(user.id, '2FA disabled', req);
    res.status(200).json({ enabled: false });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to disable 2FA', message: error.message });
  }
});

app.get('/users/2fa/status', authenticateToken, async (req, res) => {
  const tokenUser = (req as any).user;
  try {
    const user = await prisma.user.findUnique({ where: { id: tokenUser.userId }, select: { totpEnabled: true } });
    res.status(200).json({ enabled: user?.totpEnabled ?? false });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get 2FA status', message: error.message });
  }
});

// =============================================
// Push Token Registration
// =============================================
app.post('/users/push-token', authenticateToken, async (req, res) => {
  const tokenUser = (req as any).user;
  const { pushToken } = req.body;
  if (!pushToken) return res.status(400).json({ error: 'pushToken is required' });

  try {
    await prisma.user.update({ where: { id: tokenUser.userId }, data: { pushToken } });
    res.status(200).json({ status: 'registered' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to register push token', message: error.message });
  }
});

app.get('/users/push-token/:userId', requireServiceSecret, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.userId }, select: { pushToken: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(200).json({ pushToken: user.pushToken });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get push token', message: error.message });
  }
});

app.delete('/users/push-token', authenticateToken, async (req, res) => {
  const tokenUser = (req as any).user;
  try {
    await prisma.user.update({ where: { id: tokenUser.userId }, data: { pushToken: null } });
    res.status(200).json({ status: 'removed' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to remove push token', message: error.message });
  }
});

export async function seedAccounts() {
  try {
    const adminEmail = 'admin@finvault.com';
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash('admin123', BCRYPT_ROUNDS);
      const user = await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          accountType: 'business',
          status: 'active',
          plan: 'Metal',
          profile: {
            create: {
              firstName: 'FinVault',
              lastName: 'Administrator',
              dateOfBirth: '1980-01-01',
              address: 'Headquarters',
              country: 'België'
            }
          }
        }
      });
      console.log(`[Account Service] Seeded default administrator account: ${adminEmail}`);

      await publishEvent('account-service', {
        type: 'account.created',
        payload: {
          userId: user.id,
          email: user.email,
          accountType: user.accountType
        }
      }, process.env.GATEWAY_URL);
    }

    const testEmail = 'test@finvault.com';
    const existingTest = await prisma.user.findUnique({ where: { email: testEmail } });
    if (!existingTest) {
      const passwordHash = await bcrypt.hash('test123', BCRYPT_ROUNDS);
      const user = await prisma.user.create({
        data: {
          email: testEmail,
          passwordHash,
          accountType: 'personal',
          status: 'active',
          plan: 'Metal',
          profile: {
            create: {
              firstName: 'Tom',
              lastName: 'Bomeke',
              dateOfBirth: '1995-05-15',
              address: 'Meir 1, Antwerpen',
              country: 'België'
            }
          }
        }
      });
      console.log(`[Account Service] Seeded default test account: ${testEmail}`);

      await publishEvent('account-service', {
        type: 'account.created',
        payload: {
          userId: user.id,
          email: user.email,
          accountType: user.accountType
        }
      }, process.env.GATEWAY_URL);
    }
  } catch (error) {
    console.error('Failed to seed default users:', error);
  }
}
