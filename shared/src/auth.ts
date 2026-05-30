import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

// Shared JWT secret — in production this should come from a secure vault / env
export const JWT_SECRET = process.env.JWT_SECRET || 'finvault-super-secret-key-98765';

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
 * 
 * CRITICAL: This replaces the insecure base64-only decode pattern that was
 * previously used in wallet-transaction-service and invoice-service.
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch {
    return null; // expired, malformed, or tampered
  }
}

/**
 * Extracts and verifies the JWT token from an Authorization header.
 * Returns the verified payload or null.
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
 * Returns 401/403 on failure.
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
