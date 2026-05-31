import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { publishEvent, validateBody, LoginSchema, RegisterSchema } from 'shared';

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 8001;
const JWT_SECRET = process.env.JWT_SECRET || 'finvault-super-secret-key-98765';

app.use(helmet());
app.use(cors());
app.use(express.json());

// =============================================
// Rate Limiting & Account Lockout Setup
// =============================================
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const registerAttempts = new Map<string, { count: number; resetAt: number }>();
const failedLoginAttemptsByEmail = new Map<string, number>();

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

    const passwordHash = await bcrypt.hash(password, 10);
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
      return res.status(401).json({
        error: `Invalid email or password. Attempt ${attempts} of 10 before your account is frozen.`
      });
    }

    // Successful login: reset failed counter
    failedLoginAttemptsByEmail.delete(email);

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, accountType: user.accountType },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshToken,
        expiresAt
      }
    });

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
      profile: user.profile,
      createdAt: user.createdAt
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve profile', message: error.message });
  }
});

// Internal endpoint for other microservices (e.g. wallet-service) to lookup a user by email
app.get('/users/profile-by-email', async (req, res) => {
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
      const passwordHash = await bcrypt.hash('admin-secure-password-2026', 10);
      const user = await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          accountType: 'business',
          status: 'active',
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
      const passwordHash = await bcrypt.hash('test-secure-password', 10);
      const user = await prisma.user.create({
        data: {
          email: testEmail,
          passwordHash,
          accountType: 'personal',
          status: 'active',
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
  app.listen(PORT, () => {
    console.log(`[Account Service] running on http://localhost:${PORT}`);
  });
});
