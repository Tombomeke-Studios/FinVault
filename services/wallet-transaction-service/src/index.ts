import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { publishEvent, requireAuth, extractTokenFromRequest, computeTransactionHash, consumeRabbitQueue } from 'shared';
import { validateSEPAXML } from './sepa-validator.js';

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 8002;
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8000';
const ACCOUNT_SERVICE_URL = process.env.ACCOUNT_SERVICE_URL || 'http://localhost:8001';
const INVOICE_SERVICE_URL = process.env.INVOICE_SERVICE_URL || 'http://localhost:8003';

// Custom DRY wrapper for Event Hub publishing inside Docker/Local env
const publishWalletEvent = (event: any) => publishEvent('wallet-transaction-service', event, process.env.GATEWAY_URL);

// =============================================
// Security Middleware
// =============================================
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' })); // Prevent oversized payloads

// =============================================
// Idempotency Key Middleware
// =============================================
async function checkIdempotency(req: express.Request, res: express.Response): Promise<boolean> {
  const idempotencyKey = req.headers['x-idempotency-key'] as string;
  if (!idempotencyKey) return false; // No key = proceed normally

  try {
    const existing = await prisma.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
    if (existing) {
      if (existing.expiresAt > new Date()) {
        // Return cached response
        res.status(existing.statusCode).json(JSON.parse(existing.responseBody));
        return true; // Signal: response already sent
      } else {
        // Expired — delete and allow retry
        await prisma.idempotencyKey.delete({ where: { key: idempotencyKey } });
      }
    }
  } catch (error) {
    console.error('[Idempotency] Check failed:', error);
  }
  return false;
}

async function storeIdempotencyResult(key: string | undefined, statusCode: number, body: any): Promise<void> {
  if (!key) return;
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h TTL
    await prisma.idempotencyKey.create({
      data: {
        key,
        statusCode,
        responseBody: JSON.stringify(body),
        expiresAt
      }
    });
  } catch (error) {
    console.error('[Idempotency] Store failed:', error);
  }
}

// =============================================
// Internal receipt generation helper
// =============================================
async function generateReceipt(data: {
  transactionRef: string;
  payerUserId: string;
  payeeUserId?: string;
  payerEmail: string;
  payeeEmail?: string;
  amount: number;
  currency: string;
  description: string;
}): Promise<void> {
  try {
    await fetch(`${INVOICE_SERVICE_URL}/receipts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    console.log(`[Wallet Service] Receipt generated for transaction ${data.transactionRef}`);
  } catch (error: any) {
    // Non-blocking: receipt generation failure shouldn't fail the transaction
    console.error(`[Wallet Service] Receipt generation failed for ${data.transactionRef}:`, error.message);
  }
}

// =============================================
// Credit/Debit Overdraft Helper Functions
// =============================================

async function debitWallet(
  walletId: string,
  amount: number,
  prismaTx: any
): Promise<{ newBalance: number; newUsedCredit: number }> {
  const wallet = await prismaTx.wallet.findUnique({
    where: { id: walletId },
    include: { creditLine: true }
  });
  if (!wallet) throw new Error('Wallet not found');

  let availableCredit = 0.0;
  if (wallet.creditLine && ['active', 'suspended'].includes(wallet.creditLine.status)) {
    availableCredit = wallet.creditLine.creditLimit - wallet.creditLine.usedCredit;
  }

  if (wallet.balance + availableCredit < amount) {
    throw new Error('Insufficient balance');
  }

  let newBalance = wallet.balance;
  let newUsedCredit = wallet.creditLine ? wallet.creditLine.usedCredit : 0.0;

  if (newBalance >= amount) {
    newBalance -= amount;
  } else {
    const needed = amount - newBalance;
    newBalance = 0.0;
    newUsedCredit += needed;

    await prismaTx.creditLine.update({
      where: { walletId },
      data: { usedCredit: newUsedCredit }
    });
  }

  await prismaTx.wallet.update({
    where: { id: walletId },
    data: { balance: newBalance }
  });

  return { newBalance, newUsedCredit };
}

async function creditWallet(
  walletId: string,
  amount: number,
  prismaTx: any
): Promise<number> {
  const wallet = await prismaTx.wallet.findUnique({
    where: { id: walletId },
    include: { creditLine: true }
  });
  if (!wallet) throw new Error('Wallet not found');

  let remainingAmount = amount;
  let newBalance = wallet.balance;

  if (wallet.creditLine && ['active', 'suspended'].includes(wallet.creditLine.status) && wallet.creditLine.usedCredit > 0) {
    const used = wallet.creditLine.usedCredit;
    if (remainingAmount >= used) {
      await prismaTx.creditLine.update({
        where: { walletId },
        data: { usedCredit: 0.0 }
      });
      remainingAmount -= used;
    } else {
      await prismaTx.creditLine.update({
        where: { walletId },
        data: { usedCredit: used - remainingAmount }
      });
      remainingAmount = 0.0;
    }
  }

  if (remainingAmount > 0) {
    newBalance += remainingAmount;
  }

  await prismaTx.wallet.update({
    where: { id: walletId },
    data: { balance: newBalance }
  });

  return newBalance;
}

// =============================================
// Webhook listener for Gateway events (e.g. account.created)
// =============================================
app.post('/webhooks/events', async (req, res) => {
  const { event } = req.body;
  console.log(`[Wallet Service Webhook] Received event: ${event.type}`);

  if (event.type === 'account.created') {
    const { userId } = event.payload;
    try {
      // Generate structurally valid unique Belgian-like IBAN
      const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000);
      const iban = `BE8937700771${randomDigits}`;

      // Create a default wallet for new user in EUR
      const wallet = await prisma.wallet.create({
        data: {
          userId,
          iban,
          currency: 'EUR',
          balance: 250.00, // €250,00 Welcome Bonus! Premium UX
          reservedBalance: 0.0,
          status: 'active'
        }
      });

      console.log(`[Wallet Service] Default wallet created for user ${userId} with welcome bonus. IBAN: ${iban}`);

      await prisma.balanceHistory.create({
        data: {
          walletId: wallet.id,
          amount: 250.00,
          balanceAfter: 250.00,
          reason: 'Welcome Bonus'
        }
      });

      // Publish balance update event
      await publishEvent('wallet-transaction-service', {
        type: 'balance.updated',
        payload: {
          walletId: wallet.id,
          userId,
          balance: wallet.balance,
          currency: wallet.currency
        }
      });

    } catch (error) {
      console.error('[Wallet Service Webhook] Failed to process account.created:', error);
    }
  }

  res.status(200).json({ status: 'processed' });
});

// =============================================
// REST Endpoints — ALL secured with JWT verification
// =============================================

app.get('/wallets', requireAuth, async (req, res) => {
  const userId = (req as any).user.userId;

  try {
    let wallets = await prisma.wallet.findMany({
      where: { userId },
      include: { creditLine: true }
    });

    // Self-healing logic: Automatically generate a default EUR wallet if none exists
    if (wallets.length === 0) {
      console.log(`[Wallet Service] No wallet found for user ${userId}. Automatically generating default wallet.`);
      const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000);
      const iban = `BE8937700771${randomDigits}`;

      const wallet = await prisma.wallet.create({
        data: {
          userId,
          iban,
          currency: 'EUR',
          balance: 250.00,
          reservedBalance: 0.0,
          status: 'active'
        },
        include: { creditLine: true }
      });

      await prisma.balanceHistory.create({
        data: {
          walletId: wallet.id,
          amount: 250.00,
          balanceAfter: 250.00,
          reason: 'Welcome Bonus (Auto-Generated)'
        }
      });

      await publishEvent('wallet-transaction-service', {
        type: 'balance.updated',
        payload: {
          walletId: wallet.id,
          userId,
          balance: wallet.balance,
          currency: wallet.currency
        }
      });

      wallets = [wallet];
    }

    res.status(200).json(wallets);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve wallets', message: error.message });
  }
});

app.post('/wallets', requireAuth, async (req, res) => {
  const userId = (req as any).user.userId;

  const { type } = req.body;
  const accountType = type === 'savings' ? 'savings' : 'checking';
  
  // All accounts are EUR in Fase 3!
  const currency = 'EUR';
  const interestRate = accountType === 'savings' ? 0.025 : 0.0; // 2.5% rente op spaarrekening
  const startBonus = accountType === 'savings' ? 50.00 : 100.00; // €50 starting bonus for savings, €100 for checking

  try {
    const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000);
    const iban = `BE8937700771${randomDigits}`;

    const wallet = await prisma.wallet.create({
      data: {
        userId,
        iban,
        currency,
        type: accountType,
        interestRate,
        balance: startBonus,
        reservedBalance: 0.0,
        status: 'active'
      },
      include: { creditLine: true }
    });

    await prisma.balanceHistory.create({
      data: {
        walletId: wallet.id,
        amount: startBonus,
        balanceAfter: startBonus,
        reason: accountType === 'savings' ? 'Spaarrekening Geopend (Bonus)' : 'Betaalrekening Geopend (Bonus)'
      }
    });

    await publishEvent('wallet-transaction-service', {
      type: 'balance.updated',
      payload: {
        walletId: wallet.id,
        userId,
        balance: wallet.balance,
        currency: wallet.currency
      }
    });

    res.status(201).json(wallet);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create wallet', message: error.message });
  }
});

app.post('/wallets/simulate-time', requireAuth, async (req, res) => {
  const userId = (req as any).user.userId;

  const { months } = req.body;
  const simulatedMonths = parseInt(months, 10);

  if (isNaN(simulatedMonths) || simulatedMonths <= 0) {
    return res.status(400).json({ error: 'Invalid simulated months' });
  }

  try {
    // 1. Get all wallets of the user with creditLine included
    const wallets = await prisma.wallet.findMany({
      where: { userId },
      include: { creditLine: true }
    });

    const updatedWallets = [];

    // 2. Loop through all accounts, calculate interest for savings and roodstand/credit lines
    for (const wallet of wallets) {
      if (wallet.type === 'savings' && wallet.interestRate > 0) {
        // Rente = Saldo * Rentepercentage * (maanden / 12)
        const interestAmount = parseFloat((wallet.balance * wallet.interestRate * (simulatedMonths / 12)).toFixed(2));
        
        if (interestAmount > 0) {
          const newBalance = parseFloat((wallet.balance + interestAmount).toFixed(2));
          
          // Update database atomically in transaction
          await prisma.$transaction([
            prisma.wallet.update({
              where: { id: wallet.id },
              data: { balance: newBalance }
            }),
            prisma.balanceHistory.create({
              data: {
                walletId: wallet.id,
                amount: interestAmount,
                balanceAfter: newBalance,
                reason: `Rente-opbouw (${simulatedMonths} mnd @ ${(wallet.interestRate * 100).toFixed(1)}%)`
              }
            }),
            prisma.transaction.create({
              data: {
                reference: `INT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
                senderWalletId: null,
                receiverWalletId: wallet.id,
                amount: interestAmount,
                currency: wallet.currency,
                status: 'confirmed',
                type: 'deposit',
                description: `Simulatie: Rente-opbouw over ${simulatedMonths} maanden`
              }
            })
          ]);

          // Publish event
          await publishEvent('wallet-transaction-service', {
            type: 'balance.updated',
            payload: {
              walletId: wallet.id,
              userId,
              balance: newBalance,
              currency: wallet.currency
            }
          });

          updatedWallets.push({
            id: wallet.id,
            iban: wallet.iban,
            currency: wallet.currency,
            type: wallet.type,
            oldBalance: wallet.balance,
            newBalance,
            interestEarned: interestAmount
          });
        }
      } else if (wallet.type === 'checking' && wallet.creditLine && ['active', 'suspended'].includes(wallet.creditLine.status) && wallet.creditLine.usedCredit > 0) {
        // Rente op roodstand = Kredietschuld * Rentevoet * (maanden / 12)
        const debtInterest = parseFloat((wallet.creditLine.usedCredit * wallet.creditLine.interestRate * (simulatedMonths / 12)).toFixed(2));

        if (debtInterest > 0) {
          const newUsedCredit = parseFloat((wallet.creditLine.usedCredit + debtInterest).toFixed(2));
          const isOverLimit = newUsedCredit > wallet.creditLine.creditLimit;
          const finalUsedCredit = Math.min(newUsedCredit, wallet.creditLine.creditLimit);

          await prisma.$transaction([
            prisma.creditLine.update({
              where: { walletId: wallet.id },
              data: {
                usedCredit: finalUsedCredit,
                status: isOverLimit ? 'suspended' : wallet.creditLine.status
              }
            }),
            prisma.transaction.create({
              data: {
                reference: `INT-DEBT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
                senderWalletId: wallet.id,
                receiverWalletId: null,
                amount: debtInterest,
                currency: wallet.currency,
                status: 'confirmed',
                type: 'withdrawal',
                description: `Simulatie: Rente op roodstand/kredietschuld (${simulatedMonths} mnd @ ${(wallet.creditLine.interestRate * 100).toFixed(0)}%)`
              }
            })
          ]);

          updatedWallets.push({
            id: wallet.id,
            iban: wallet.iban,
            currency: wallet.currency,
            type: wallet.type,
            oldBalance: -wallet.creditLine.usedCredit,
            newBalance: -finalUsedCredit,
            interestCharged: debtInterest,
            status: isOverLimit ? 'suspended' : 'active'
          });
        }
      }
    }

    // 3. Process mandate charges via invoice-service
    try {
      await fetch(`${INVOICE_SERVICE_URL}/mandates/process-charges`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Service-Secret': process.env.SERVICE_SECRET || 'finvault-internal-service-secret'
        },
        body: JSON.stringify({ simulatedMonths })
      });
      console.log(`[Wallet Service] Mandate charges processed for ${simulatedMonths} month(s)`);
    } catch (error: any) {
      console.error('[Wallet Service] Mandate charge processing failed:', error.message);
    }

    res.status(200).json({
      message: `Tijdsimulatie van ${simulatedMonths} maanden succesvol uitgevoerd.`,
      updatedAccounts: updatedWallets
    });

  } catch (error: any) {
    console.error('Time simulation error:', error);
    res.status(500).json({ error: 'Time simulation failed', message: error.message });
  }
});

app.get('/wallets/:walletId/history', requireAuth, async (req, res) => {
  const { walletId } = req.params;
  const userId = (req as any).user.userId;

  try {
    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
    if (wallet.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

    const history = await prisma.balanceHistory.findMany({
      where: { walletId },
      orderBy: { timestamp: 'asc' } // chronological order for graphs!
    });
    res.status(200).json(history);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve balance history', message: error.message });
  }
});

app.post('/wallets/deposit', requireAuth, async (req, res) => {
  const { walletId, amount } = req.body;
  const userId = (req as any).user.userId;

  if (!walletId || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid walletId or amount' });
  }

  if (amount > 1_000_000) {
    return res.status(400).json({ error: 'Maximum single deposit is €1,000,000' });
  }

  // Idempotency check
  if (await checkIdempotency(req, res)) return;

  try {
    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
    if (wallet.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

    // Use the creditWallet helper which pays off credit line debt first
    const newBalance = await creditWallet(walletId, amount, prisma);
    const reference = `DEP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Compute integrity hash
    const integrityHash = computeTransactionHash({
      senderWalletId: null,
      receiverWalletId: walletId,
      amount,
      reference,
      currency: wallet.currency
    });

    const updatedWallet = await prisma.wallet.findUnique({
      where: { id: walletId },
      include: { creditLine: true }
    });

    await prisma.balanceHistory.create({
      data: {
        walletId,
        amount,
        balanceAfter: newBalance,
        reason: 'Deposit simulator'
      }
    });

    // Create a transaction log with integrity hash
    await prisma.transaction.create({
      data: {
        reference,
        senderWalletId: null,
        receiverWalletId: walletId,
        amount,
        currency: wallet.currency,
        status: 'confirmed',
        type: 'deposit',
        description: 'Simulated cash deposit',
        integrityHash
      }
    });

    // Publish event
    await publishEvent('wallet-transaction-service', {
      type: 'balance.updated',
      payload: {
        walletId,
        userId: wallet.userId,
        balance: newBalance,
        currency: wallet.currency
      }
    });

    // Generate receipt asynchronously
    generateReceipt({
      transactionRef: reference,
      payerUserId: 'EXTERNAL',
      payeeUserId: wallet.userId,
      payerEmail: 'cash-deposit@finvault.com',
      payeeEmail: (req as any).user.email,
      amount,
      currency: wallet.currency,
      description: 'Cash Deposit'
    });

    const responseBody = updatedWallet;
    await storeIdempotencyResult(req.headers['x-idempotency-key'] as string, 200, responseBody);

    res.status(200).json(responseBody);
  } catch (error: any) {
    res.status(500).json({ error: 'Deposit failed', message: error.message });
  }
});

app.get('/transactions', requireAuth, async (req, res) => {
  const userId = (req as any).user.userId;

  try {
    // 1. Get all wallets of the user
    const wallets = await prisma.wallet.findMany({
      where: { userId }
    });
    const walletIds = wallets.map(w => w.id);

    // 2. Get all transactions involving these wallets
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { senderWalletId: { in: walletIds } },
          { receiverWalletId: { in: walletIds } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(transactions);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve transactions', message: error.message });
  }
});

// P2P Transfer (Atomically) — with idempotency + integrity hash + auto-receipt
app.post('/transactions/transfer', requireAuth, async (req, res) => {
  const { senderWalletId, receiverEmail, amount, description } = req.body;
  const userId = (req as any).user.userId;

  if (!senderWalletId || !receiverEmail || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid transfer details' });
  }

  if (amount > 1_000_000) {
    return res.status(400).json({ error: 'Maximum single transfer is €1,000,000' });
  }

  // Idempotency check
  if (await checkIdempotency(req, res)) return;

  // Deduplication check: check identical transaction in last 10s
  const recentTx = await prisma.transaction.findFirst({
    where: {
      senderWalletId,
      amount,
      description: description || 'Transfer',
      createdAt: {
        gt: new Date(Date.now() - 10000)
      }
    }
  });

  if (recentTx) {
    return res.status(409).json({ error: 'Duplicate transaction detected. Please wait 10 seconds.' });
  }

  try {
    // 1. Validate sender wallet
    const senderWallet = await prisma.wallet.findUnique({
      where: { id: senderWalletId },
      include: { creditLine: true }
    });
    if (!senderWallet) return res.status(404).json({ error: 'Sender wallet not found' });
    if (senderWallet.userId !== userId) return res.status(403).json({ error: 'Unauthorized to spend from this wallet' });

    let availableCredit = 0.0;
    if (senderWallet.creditLine && ['active', 'suspended'].includes(senderWallet.creditLine.status)) {
      availableCredit = senderWallet.creditLine.creditLimit - senderWallet.creditLine.usedCredit;
    }

    if (senderWallet.balance + availableCredit < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // 2. Find receiver via Account Service
    let receiverUserId: string | null = null;
    try {
      const response = await fetch(`${ACCOUNT_SERVICE_URL}/users/profile-by-email?email=${encodeURIComponent(receiverEmail)}`);
      if (response.ok) {
        const data = await response.json();
        receiverUserId = data.id;
      }
    } catch (err: any) {
      console.error('[Wallet Service] Failed to call Account Service to resolve email:', err.message);
    }

    if (!receiverUserId) {
      return res.status(404).json({ error: `No FinVault account found for email: ${receiverEmail}` });
    }

    // 3. Find receiver wallet
    const receiverWallet = await prisma.wallet.findFirst({
      where: { userId: receiverUserId, currency: senderWallet.currency }
    });

    if (!receiverWallet) {
      return res.status(404).json({ error: 'Receiver has no matching wallet for this currency' });
    }

    if (senderWallet.id === receiverWallet.id) {
      return res.status(400).json({ error: 'Cannot transfer to the same wallet' });
    }

    const reference = `TX-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    // Compute integrity hash
    const integrityHash = computeTransactionHash({
      senderWalletId: senderWallet.id,
      receiverWalletId: receiverWallet.id,
      amount,
      reference,
      currency: senderWallet.currency
    });

    // 4. Perform atomic double-entry bookkeeping in Prisma Transaction
    const [transaction, debitRes, receiverBalance] = await prisma.$transaction(async (prismaTx) => {
      // 1. Debit sender
      const debitRes = await debitWallet(senderWallet.id, amount, prismaTx);
      
      // 2. Credit receiver
      const receiverBalance = await creditWallet(receiverWallet.id, amount, prismaTx);

      // 3. Create transaction log with integrity hash
      const transaction = await prismaTx.transaction.create({
        data: {
          reference,
          senderWalletId: senderWallet.id,
          receiverWalletId: receiverWallet.id,
          amount,
          currency: senderWallet.currency,
          status: 'confirmed',
          type: 'transfer',
          description: description || `Transfer to ${receiverEmail}`,
          integrityHash
        }
      });

      // 4. Log sender balance history
      await prismaTx.balanceHistory.create({
        data: {
          walletId: senderWallet.id,
          amount: -amount,
          balanceAfter: debitRes.newBalance,
          reason: description || `Transfer to ${receiverEmail}`
        }
      });

      // 5. Log receiver balance history
      await prismaTx.balanceHistory.create({
        data: {
          walletId: receiverWallet.id,
          amount: amount,
          balanceAfter: receiverBalance,
          reason: `Transfer from ${(req as any).user.email}`
        }
      });

      return [transaction, debitRes, receiverBalance];
    });

    console.log(`[Wallet Service] P2P transaction confirmed: ${reference}`);

    // Publish event for payment confirmed
    await publishEvent('wallet-transaction-service', {
      type: 'payment.confirmed',
      payload: {
        transactionId: transaction.id,
        reference,
        amount,
        senderWalletId: senderWallet.id,
        receiverWalletId: receiverWallet.id
      }
    });

    // Publish balance updates for both users
    await publishEvent('wallet-transaction-service', {
      type: 'balance.updated',
      payload: {
        walletId: senderWallet.id,
        userId: senderWallet.userId,
        balance: debitRes.newBalance,
        currency: senderWallet.currency
      }
    });

    await publishEvent('wallet-transaction-service', {
      type: 'balance.updated',
      payload: {
        walletId: receiverWallet.id,
        userId: receiverWallet.userId,
        balance: receiverBalance,
        currency: receiverWallet.currency
      }
    });

    // Generate receipt asynchronously (non-blocking)
    generateReceipt({
      transactionRef: reference,
      payerUserId: senderWallet.userId,
      payeeUserId: receiverWallet.userId,
      payerEmail: (req as any).user.email,
      payeeEmail: receiverEmail,
      amount,
      currency: senderWallet.currency,
      description: description || `Transfer to ${receiverEmail}`
    });

    const responseBody = { message: 'Transfer successful', transaction };
    await storeIdempotencyResult(req.headers['x-idempotency-key'] as string, 200, responseBody);

    res.status(200).json(responseBody);
  } catch (error: any) {
    console.error('Transfer error:', error);
    res.status(500).json({ error: 'Transfer failed', message: error.message });
  }
});

// SEPA Pain.001 Credit Transfer Processing Endpoint (Validates XML input against custom XSD constraints)
app.post('/transactions/sepa-transfer', requireAuth, async (req, res) => {
  const { xmlContent } = req.body;
  if (!xmlContent) {
    return res.status(400).json({ error: 'XML body with <xmlContent> parameter is required.' });
  }

  // 1. Perform XSD Structure Check
  const validation = validateSEPAXML(xmlContent);
  if (!validation.isValid || !validation.paymentInfo) {
    return res.status(400).json({
      error: 'XSD Validation Failed: Document does not match SEPA Pain.001.001.03 rules.',
      details: validation.errors
    });
  }

  const { senderIban, receiverIban, amount, currency, description, reference } = validation.paymentInfo;

  try {
    // 2. Resolve sender wallet by IBAN
    const senderWallet = await prisma.wallet.findUnique({
      where: { iban: senderIban },
      include: { creditLine: true }
    });
    if (!senderWallet) {
      return res.status(404).json({ error: `SEPA processing aborted: Debtor account with IBAN ${senderIban} not found.` });
    }

    let availableCredit = 0.0;
    if (senderWallet.creditLine && ['active', 'suspended'].includes(senderWallet.creditLine.status)) {
      availableCredit = senderWallet.creditLine.creditLimit - senderWallet.creditLine.usedCredit;
    }

    if (senderWallet.balance + availableCredit < amount) {
      return res.status(400).json({ error: 'SEPA processing aborted: Insufficient funds in debtor wallet.' });
    }

    // 3. Resolve receiver wallet by IBAN
    const receiverWallet = await prisma.wallet.findUnique({ where: { iban: receiverIban } });
    if (!receiverWallet) {
      return res.status(404).json({ error: `SEPA processing aborted: Creditor account with IBAN ${receiverIban} not found.` });
    }

    if (senderWallet.id === receiverWallet.id) {
      return res.status(400).json({ error: 'SEPA processing aborted: Cannot execute self-transfers.' });
    }

    // 4. Deduplication: Check identical reference within last 30 seconds
    const recentTx = await prisma.transaction.findFirst({
      where: {
        reference,
        createdAt: {
          gt: new Date(Date.now() - 30000)
        }
      }
    });

    if (recentTx) {
      return res.status(409).json({ error: 'Duplicate SEPA transfer detected. Reference must be unique.' });
    }

    // Compute integrity hash
    const integrityHash = computeTransactionHash({
      senderWalletId: senderWallet.id,
      receiverWalletId: receiverWallet.id,
      amount,
      reference,
      currency
    });

    // 5. Execute atomic double-entry bookkeeping ledger entry
    const [transaction, debitRes, receiverBalance] = await prisma.$transaction(async (prismaTx) => {
      // 1. Debit sender
      const debitRes = await debitWallet(senderWallet.id, amount, prismaTx);
      
      // 2. Credit receiver
      const receiverBalance = await creditWallet(receiverWallet.id, amount, prismaTx);

      // 3. Create transaction log with integrity hash
      const transaction = await prismaTx.transaction.create({
        data: {
          reference,
          senderWalletId: senderWallet.id,
          receiverWalletId: receiverWallet.id,
          amount,
          currency,
          status: 'confirmed',
          type: 'transfer',
          description: `SEPA: ${description}`,
          integrityHash
        }
      });

      // 4. Log sender balance history
      await prismaTx.balanceHistory.create({
        data: {
          walletId: senderWallet.id,
          amount: -amount,
          balanceAfter: debitRes.newBalance,
          reason: `SEPA Credit Transfer out (Msg: ${validation.paymentInfo!.msgId})`
        }
      });

      // 5. Log receiver balance history
      await prismaTx.balanceHistory.create({
        data: {
          walletId: receiverWallet.id,
          amount,
          balanceAfter: receiverBalance,
          reason: `SEPA Credit Transfer in (Msg: ${validation.paymentInfo!.msgId})`
        }
      });

      return [transaction, debitRes, receiverBalance];
    });

    console.log(`[Wallet Service] SEPA XML Pain.001 Credit Transfer processed successfully. Ref: ${reference}`);

    // 6. Dispatch confirmed and balance update events to Event Hub
    await publishEvent('wallet-transaction-service', {
      type: 'payment.confirmed',
      payload: {
        transactionId: transaction.id,
        reference,
        amount,
        senderWalletId: senderWallet.id,
        receiverWalletId: receiverWallet.id
      }
    });

    await publishEvent('wallet-transaction-service', {
      type: 'balance.updated',
      payload: {
        walletId: senderWallet.id,
        userId: senderWallet.userId,
        balance: debitRes.newBalance,
        currency: senderWallet.currency
      }
    });

    await publishEvent('wallet-transaction-service', {
      type: 'balance.updated',
      payload: {
        walletId: receiverWallet.id,
        userId: receiverWallet.userId,
        balance: receiverBalance,
        currency: receiverWallet.currency
      }
    });

    // Generate receipt for SEPA transfer
    generateReceipt({
      transactionRef: reference,
      payerUserId: senderWallet.userId,
      payeeUserId: receiverWallet.userId,
      payerEmail: `IBAN:${senderIban}`,
      payeeEmail: `IBAN:${receiverIban}`,
      amount,
      currency,
      description: `SEPA: ${description}`
    });

    res.status(200).json({
      message: 'SEPA Pain.001 XML Credit Transfer successfully validated and processed.',
      transaction
    });

  } catch (error: any) {
    console.error('SEPA processing failure:', error);
    res.status(500).json({ error: 'SEPA processing failed', message: error.message });
  }
});

// Internal endpoint for invoice-service to execute mandate charges
app.post('/transactions/internal-transfer', async (req, res) => {
  // Verify internal service secret
  const serviceSecret = req.headers['x-service-secret'] as string;
  if (serviceSecret !== (process.env.SERVICE_SECRET || 'finvault-internal-service-secret')) {
    return res.status(403).json({ error: 'Forbidden: Internal endpoint requires service authentication' });
  }

  const { senderWalletId, receiverWalletId, senderUserId, receiverUserId, amount, description, reference: externalRef } = req.body;

  if ((!senderWalletId && !senderUserId) || (!receiverWalletId && !receiverUserId) || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid transfer details' });
  }

  try {
    let senderWallet = null;
    if (senderWalletId) {
      senderWallet = await prisma.wallet.findUnique({
        where: { id: senderWalletId },
        include: { creditLine: true }
      });
    } else if (senderUserId) {
      senderWallet = await prisma.wallet.findFirst({
        where: { userId: senderUserId, type: 'checking', currency: 'EUR' },
        include: { creditLine: true }
      });
    }

    let receiverWallet = null;
    if (receiverWalletId) {
      receiverWallet = await prisma.wallet.findUnique({ where: { id: receiverWalletId } });
    } else if (receiverUserId) {
      receiverWallet = await prisma.wallet.findFirst({
        where: { userId: receiverUserId, type: 'checking', currency: 'EUR' }
      });
    }

    if (!senderWallet || !receiverWallet) {
      return res.status(404).json({ error: 'Sender or Receiver checking wallet not found' });
    }

    let availableCredit = 0.0;
    if (senderWallet.creditLine && ['active', 'suspended'].includes(senderWallet.creditLine.status)) {
      availableCredit = senderWallet.creditLine.creditLimit - senderWallet.creditLine.usedCredit;
    }

    if (senderWallet.balance + availableCredit < amount) {
      return res.status(400).json({ error: 'Insufficient balance for mandate charge' });
    }

    const reference = externalRef || `MND-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    const integrityHash = computeTransactionHash({
      senderWalletId: senderWallet.id,
      receiverWalletId: receiverWallet.id,
      amount,
      reference,
      currency: senderWallet.currency
    });

    const [transaction, debitRes, receiverBalance] = await prisma.$transaction(async (prismaTx) => {
      // 1. Debit sender
      const debitRes = await debitWallet(senderWallet.id, amount, prismaTx);
      
      // 2. Credit receiver
      const receiverBalance = await creditWallet(receiverWallet.id, amount, prismaTx);

      // 3. Create transaction log with integrity hash
      const transaction = await prismaTx.transaction.create({
        data: {
          reference,
          senderWalletId: senderWallet.id,
          receiverWalletId: receiverWallet.id,
          amount,
          currency: senderWallet.currency,
          status: 'confirmed',
          type: 'payment',
          description: description || 'Automatische Incasso',
          integrityHash
        }
      });

      // 4. Log sender balance history
      await prismaTx.balanceHistory.create({
        data: {
          walletId: senderWallet.id,
          amount: -amount,
          balanceAfter: debitRes.newBalance,
          reason: description || 'Automatische Incasso'
        }
      });

      // 5. Log receiver balance history
      await prismaTx.balanceHistory.create({
        data: {
          walletId: receiverWallet.id,
          amount,
          balanceAfter: receiverBalance,
          reason: `Ontvangen: ${description || 'Automatische Incasso'}`
        }
      });

      return [transaction, debitRes, receiverBalance];
    });

    // Publish events
    await publishEvent('wallet-transaction-service', {
      type: 'payment.confirmed',
      payload: {
        transactionId: transaction.id,
        reference,
        amount,
        senderWalletId: senderWallet.id,
        receiverWalletId: receiverWallet.id
      }
    });

    await publishEvent('wallet-transaction-service', {
      type: 'balance.updated',
      payload: {
        walletId: senderWallet.id,
        userId: senderWallet.userId,
        balance: debitRes.newBalance,
        currency: senderWallet.currency
      }
    });

    await publishEvent('wallet-transaction-service', {
      type: 'balance.updated',
      payload: {
        walletId: receiverWallet.id,
        userId: receiverWallet.userId,
        balance: receiverBalance,
        currency: receiverWallet.currency
      }
    });

    res.status(200).json({ message: 'Internal transfer successful', transaction });
  } catch (error: any) {
    console.error('Internal transfer error:', error);
    res.status(500).json({ error: 'Internal transfer failed', message: error.message });
  }
});

// Expose endpoint to activate or modify credit limits (up to €5000) and toggle status
app.post('/wallets/:walletId/credit-line', requireAuth, async (req, res) => {
  const { walletId } = req.params;
  const { creditLimit, status } = req.body;
  const userId = (req as any).user.userId;

  if (creditLimit !== undefined && (typeof creditLimit !== 'number' || creditLimit < 0 || creditLimit > 5000)) {
    return res.status(400).json({ error: 'Credit limit must be a positive number up to €5000' });
  }

  if (status !== undefined && !['inactive', 'active', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'Invalid credit line status. Allowed: inactive, active, suspended' });
  }

  try {
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
      include: { creditLine: true }
    });

    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
    if (wallet.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
    if (wallet.type !== 'checking') {
      return res.status(400).json({ error: 'Credit line can only be activated for checking accounts' });
    }

    // Upsert creditLine
    const creditLine = await prisma.creditLine.upsert({
      where: { walletId },
      create: {
        walletId,
        creditLimit: creditLimit ?? 500.0, // default limit is €500
        interestRate: 0.15, // 15% annual overdraft rate
        status: status ?? 'active',
        usedCredit: 0.0
      },
      update: {
        creditLimit: creditLimit !== undefined ? creditLimit : undefined,
        status: status !== undefined ? status : undefined
      }
    });

    res.status(200).json(creditLine);
  } catch (error: any) {
    console.error('Credit line update error:', error);
    res.status(500).json({ error: 'Failed to update credit line', message: error.message });
  }
});

async function startRabbitConsumer() {
  try {
    const queueName = 'wallet_service_queue';
    const topics = ['events.account.created', 'events.account.frozen'];
    
    await consumeRabbitQueue(queueName, topics, async (envelope) => {
      console.log(`[Wallet Service RabbitMQ] Processing dynamic queue message: ${envelope.event.type}`);
      
      const { type, payload } = envelope.event;
      
      if (type === 'account.created') {
        const { userId } = payload as any;
        
        // Prevent duplicate wallet creation
        const existing = await prisma.wallet.findFirst({ where: { userId } });
        if (existing) {
          console.log(`[Wallet Service RabbitMQ] Wallet already exists for user ${userId}, skipping.`);
          return;
        }

        // Generate structurally valid unique Belgian-like IBAN
        const randomDigits = Math.floor(1000000000 + Math.random() * 9000000000);
        const iban = `BE8937700771${randomDigits}`;

        // Create a default wallet for new user in EUR
        const wallet = await prisma.wallet.create({
          data: {
            userId,
            iban,
            currency: 'EUR',
            balance: 250.00, // €250,00 Welcome Bonus! Premium UX
            reservedBalance: 0.0,
            status: 'active'
          }
        });

        console.log(`[Wallet Service RabbitMQ] Default wallet created for user ${userId}. IBAN: ${iban}`);

        await prisma.balanceHistory.create({
          data: {
            walletId: wallet.id,
            amount: 250.00,
            balanceAfter: 250.00,
            reason: 'Welcome Bonus'
          }
        });

        // Publish balance update event
        await publishWalletEvent({
          type: 'balance.updated',
          payload: {
            walletId: wallet.id,
            userId,
            balance: 250.00,
            currency: 'EUR'
          }
        });
      } else if (type === 'account.frozen') {
        const { userId } = payload as any;
        await prisma.wallet.updateMany({
          where: { userId },
          data: { status: 'frozen' }
        });
        console.log(`[Wallet Service RabbitMQ] Frozen all wallets for user ${userId}`);
      }
    });
  } catch (error: any) {
    console.error('[Wallet Service RabbitMQ] Failed to start RabbitMQ consumer:', error.message);
  }
}

app.listen(PORT, () => {
  console.log(`[Wallet & Transaction Service] running on http://localhost:${PORT}`);
  startRabbitConsumer();
});
