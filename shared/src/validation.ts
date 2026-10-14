import { z } from 'zod';

// =============================================
// Authentication Schemas
// =============================================

export const LoginSchema = z.object({
  email: z.string().email('Invalid email format').max(255, 'Email too long'),
  // Only that there is one. The rules for choosing a password belong to
  // registration: applied here they reject an existing account whose password
  // predates them before it is ever compared (#92).
  password: z.string().min(1, 'Password is required').max(128, 'Password too long')
});

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().min(1, 'First name required').max(100).regex(/^[a-zA-ZÀ-ÿ\s'\-]+$/, 'Invalid characters in name'),
  lastName: z.string().min(1, 'Last name required').max(100).regex(/^[a-zA-ZÀ-ÿ\s'\-]+$/, 'Invalid characters in name'),
  dateOfBirth: z.string().optional(),
  address: z.string().max(500).optional(),
  country: z.string().max(100).optional(),
  accountType: z.enum(['personal', 'business']).optional()
});

// =============================================
// Transaction Schemas
// =============================================

export const DepositSchema = z.object({
  walletId: z.string().uuid('Invalid wallet ID'),
  amount: z.number().positive('Amount must be positive').max(1_000_000, 'Maximum single deposit is €1,000,000'),
  currency: z.string().length(3).default('EUR'),
  description: z.string().max(500).optional()
});

export const TransferSchema = z.object({
  senderWalletId: z.string().uuid('Invalid sender wallet ID'),
  receiverEmail: z.string().email('Invalid recipient email').max(255),
  amount: z.number().positive('Amount must be positive').max(1_000_000, 'Maximum single transfer is €1,000,000'),
  description: z.string().max(500).optional()
});

export const TransferByIbanSchema = z.object({
  senderWalletId: z.string().uuid('Invalid sender wallet ID'),
  receiverIban: z.string()
    .min(15, 'IBAN too short')
    .max(34, 'IBAN too long')
    .regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/, 'Invalid IBAN format'),
  amount: z.number().positive('Amount must be positive').max(1_000_000, 'Maximum single transfer is €1,000,000'),
  description: z.string().max(500).optional()
});

// =============================================
// Payment Request Schemas (Tikkie-model)
// =============================================

export const PaymentRequestSchema = z.object({
  recipientEmail: z.string().email('Invalid recipient email').max(255),
  amount: z.number().positive('Amount must be positive').max(100_000, 'Maximum payment request is €100,000'),
  description: z.string().min(1, 'Description required').max(500)
});

// =============================================
// Mandate Schemas (Automatische Incasso)
// =============================================

export const MandateSchema = z.object({
  payeeEmail: z.string().email('Invalid payee email').max(255),
  amount: z.number().positive('Amount must be positive').max(50_000, 'Maximum mandate amount is €50,000'),
  description: z.string().min(1, 'Description required').max(500),
  intervalDays: z.number().int().min(1).max(365).default(30)
});

// =============================================
// Helper: validate request body with Zod
// =============================================

import type { Request, Response } from 'express';

/**
 * Validates req.body against a Zod schema.
 * Returns the parsed data on success, or sends a 400 and returns null on failure.
 */
export function validateBody<T>(schema: z.ZodSchema<T>, req: Request, res: Response): T | null {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    res.status(400).json({ error: 'Validation failed', details: errors });
    return null;
  }
  return result.data;
}
