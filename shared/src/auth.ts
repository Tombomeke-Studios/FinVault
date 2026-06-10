import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

/**
 * Returns the JWT signing secret.
 *
 * IMPORTANT — do NOT read this at module level.
 * In ESM the entire import graph is resolved before any application code runs,
 * so module-level `const JWT_SECRET = process.env.JWT_SECRET` would be
 * evaluated before dotenv.config() has a chance to populate process.env.
 * Call this function from inside middleware / request handlers instead.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.warn(
      '[shared/auth] WARNING: JWT_SECRET env var not set — using the built-in development ' +
      'fallback. Anyone with the source can forge tokens. Set JWT_SECRET before deploying.'
    );
    return 'finvault-super-secret-key-98765';
  }
  return secret;
}

/**
 * Returns the internal service-to-service secret.
 * Same ESM hoisting caveat as getJwtSecret().
 */
export function getServiceSecret(): string {
  const secret = process.env.SERVICE_SECRET;
  if (!secret) {
    console.warn(
      '[shared/auth] WARNING: SERVICE_SECRET env var not set — internal endpoints are using ' +
      'the built-in development fallback. Set SERVICE_SECRET before deploying.'
    );
    return 'finvault-internal-service-secret';
  }
  return secret;
}

export interface JWTPayload {
  userId: string;
  email: string;
  accountType?: string;
  iat?: number;
  exp?: number;
}

/**
 * Cryptographically verifies a JWT token and returns the decoded payload.
 * Returns null if the token is invalid, expired, or tampered with.
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JWTPayload;
    return decoded;
  } catch {
    return null; // expired, malformed, or tampered
  }
}

/**
 * Extracts and verifies the JWT token from an Authorization header.
 */
export function extractTokenFromRequest(req: Request): JWTPayload | null {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Express middleware that enforces JWT authentication.
 * Attaches verified user to `req.user` on success.
 * Returns 401 on failure.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const user = extractTokenFromRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Provide a valid Bearer token.' });
    return;
  }
  (req as any).user = user;
  next();
}

/**
 * Express middleware for internal service-to-service endpoints.
 * Requires the X-Service-Secret header to match SERVICE_SECRET.
 */
export function requireServiceSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers['x-service-secret'] as string | undefined;
  if (secret !== getServiceSecret()) {
    res.status(403).json({ error: 'Forbidden: internal endpoint requires service authentication' });
    return;
  }
  next();
}

/**
 * @deprecated Use getJwtSecret() instead.
 * This re-export exists only so services that destructure `{ JWT_SECRET }` from
 * shared still compile. Switch callers to getJwtSecret() over time.
 * WARNING: this value is frozen at the time shared is first imported.
 * Use --env-file flag (Node 20+) so env is set before the module graph loads.
 */
export const JWT_SECRET = getJwtSecret();

/**
 * @deprecated Use getServiceSecret() instead.
 */
export const SERVICE_SECRET = getServiceSecret();
