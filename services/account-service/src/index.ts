import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { publishEvent } from 'shared';

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 8001;
const JWT_SECRET = process.env.JWT_SECRET || 'finvault-super-secret-key-98765';

app.use(cors());
app.use(express.json());

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
  const { email, password, firstName, lastName, dateOfBirth, address, country, accountType } = req.body;

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

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
    });

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
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true }
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      await logAudit(null, `Failed login attempt for email: ${email}`, req);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status === 'frozen') {
      await logAudit(user.id, 'Blocked login attempt on frozen account', req);
      return res.status(403).json({ error: 'Account has been frozen by administrator' });
    }

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

app.listen(PORT, () => {
  console.log(`[Account Service] running on http://localhost:${PORT}`);
});
