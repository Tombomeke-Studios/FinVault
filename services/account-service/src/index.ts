
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import { PrismaClient } from '../generated/prisma/index.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { publishEvent, validateBody, LoginSchema, RegisterSchema, requireServiceSecret } from 'shared';

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 8001;
const JWT_SECRET = process.env.JWT_SECRET || 'finvault-super-secret-key-98765';
const BCRYPT_ROUNDS = 12;

// Refresh tokens are stored hashed — a database leak must not yield usable tokens.
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

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
const failedLoginAttemptsByEmail = new Map<string, number>();

// Periodic cleanup so the in-memory rate-limit maps and the refresh-token
// table don't grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of loginAttempts) if (now > v.resetAt) loginAttempts.delete(k);
  for (const [k, v] of registerAttempts) if (now > v.resetAt) registerAttempts.delete(k);
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


// Authentication Middleware
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

// Log action helper
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

// REST Endpoints
app.post('/auth/register', async (req, res) => {
  // Rate limiting check
  const ip = req.ip || '127.0.0.1';
  const limitRes = checkRateLimit(ip, registerAttempts, 3, 60 * 60 * 1000);
  if (!limitRes.allowed) {
    return res.status(429).json({
      error: 'Too many account registrations. Please try again in 1 hour.',
      resetAt: limitRes.resetAt
    });
  }

  // Zod validation
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

    // Publish event: account.created
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
  // Rate limiting check
  const ip = req.ip || '127.0.0.1';
  const limitRes = checkRateLimit(ip, loginAttempts, 5, 15 * 60 * 1000);
  if (!limitRes.allowed) {
    return res.status(429).json({
      error: 'Too many login attempts. Please try again in 15 minutes.',
      resetAt: limitRes.resetAt
    });
  }

  // Zod validation
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
      // Handle failed attempt & account lockout
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
      // Same generic message as the unknown-email path — the response must not
      // reveal whether the account exists or how close it is to lockout.
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Successful login: reset failed counter
    failedLoginAttemptsByEmail.delete(email);

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

// Exchange a valid refresh token for a fresh token pair (rotation: the used
// refresh token is revoked, so a stolen-and-replayed token is detectable).
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
      // Token replay or already rotated — revoke everything for this user as a precaution.
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

// Revoke the supplied refresh token (sign-out). Idempotent.
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

    res.status(200).json({
      id: user.id,
      email: user.email,
      accountType: user.accountType,
      status: user.status,
      plan: user.plan,
      profile: user.profile,
      createdAt: user.createdAt
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve profile', message: error.message });
  }
});

app.put('/users/plan', authenticateToken, async (req, res) => {
  const tokenUser = (req as any).user;
  const { plan } = req.body;

  if (!plan || !['Standard', 'Metal', 'Metal+'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan selected' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: tokenUser.userId },
      data: { plan },
      include: { profile: true }
    });

    res.status(200).json({
      id: user.id,
      email: user.email,
      accountType: user.accountType,
      status: user.status,
      plan: user.plan,
      profile: user.profile,
      createdAt: user.createdAt
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update plan', message: error.message });
  }
});

// Internal endpoint for other microservices (e.g. wallet-service) to lookup a user by email.
// Guarded by X-Service-Secret: it is reachable through the public gateway (/api/users/*),
// so without the guard it leaks profile PII and allows user enumeration.
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

// Seed default accounts on startup
async function seedAccounts() {
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

      // Publish event: account.created so Wallet service can dynamically create their wallet/IBAN
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

      // Publish event
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

seedAccounts().then(() => {
  let retries = 8;
  const start = () => {
    const srv = app.listen(PORT, () => console.log(`[Account Service] running on http://localhost:${PORT}`));
    srv.once('error', (e: any) => {
      srv.close();
      if (e.code === 'EADDRINUSE' && retries-- > 0) {
        console.log(`[Account Service] port ${PORT} busy, retrying in 600ms...`);
        setTimeout(start, 600);
      } else { console.error(e); process.exit(1); }
    });
    const shutdown = () => {
      (srv as any).closeAllConnections?.();
      srv.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 500);
    };
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.on('SIGTERM', shutdown);
    process.on('SIGINT',  shutdown);
  };
  start();
});
