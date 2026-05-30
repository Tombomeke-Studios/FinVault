import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { publishEvent } from 'shared';
import { validateSEPAXML } from './sepa-validator.js';

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 8002;
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8000';
const ACCOUNT_SERVICE_URL = process.env.ACCOUNT_SERVICE_URL || 'http://localhost:8001';

// Custom DRY wrapper for Event Hub publishing inside Docker/Local env
const publishWalletEvent = (event: any) => publishEvent('wallet-transaction-service', event, process.env.GATEWAY_URL);

app.use(cors());
app.use(express.json());

// Helper to get userId from headers/token
const getUserIdFromHeaders = (req: express.Request): string | null => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  try {
    const payload: any = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.userId || null;
  } catch {
    return null;
  }
};

// Webhook listener for Gateway events (e.g. account.created)
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

// REST Endpoints
// REST Endpoints
app.get('/wallets', async (req, res) => {
  const userId = getUserIdFromHeaders(req) || req.query.userId as string;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: userId required' });
  }

  try {
    let wallets = await prisma.wallet.findMany({
      where: { userId }
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
          balance: 250.00, // €250,00 Welcome Bonus! Premium UX
          reservedBalance: 0.0,
          status: 'active'
        }
      });

      await prisma.balanceHistory.create({
        data: {
          walletId: wallet.id,
          amount: 250.00,
          balanceAfter: 250.00,
          reason: 'Welcome Bonus (Auto-Generated)'
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

      wallets = [wallet];
    }

    res.status(200).json(wallets);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve wallets', message: error.message });
  }
});

app.post('/wallets', async (req, res) => {
  const userId = getUserIdFromHeaders(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: userId required' });
  }

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
      }
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

app.post('/wallets/simulate-time', async (req, res) => {
  const userId = getUserIdFromHeaders(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: userId required' });
  }

  const { months } = req.body;
  const simulatedMonths = parseInt(months, 10);

  if (isNaN(simulatedMonths) || simulatedMonths <= 0) {
    return res.status(400).json({ error: 'Invalid simulated months' });
  }

  try {
    // 1. Get all wallets of the user
    const wallets = await prisma.wallet.findMany({
      where: { userId }
    });

    const updatedWallets = [];

    // 2. Loop through all accounts, calculate interest for savings accounts
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
      }
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

app.get('/wallets/:walletId/history', async (req, res) => {
  const { walletId } = req.params;
  const userId = getUserIdFromHeaders(req);

  try {
    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
    if (userId && wallet.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

    const history = await prisma.balanceHistory.findMany({
      where: { walletId },
      orderBy: { timestamp: 'asc' } // chronological order for graphs!
    });
    res.status(200).json(history);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve balance history', message: error.message });
  }
});

app.post('/wallets/deposit', async (req, res) => {
  const { walletId, amount } = req.body;
  const userId = getUserIdFromHeaders(req);

  if (!walletId || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid walletId or amount' });
  }

  try {
    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
    if (userId && wallet.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

    const newBalance = wallet.balance + amount;
    const updatedWallet = await prisma.wallet.update({
      where: { id: walletId },
      data: { balance: newBalance }
    });

    await prisma.balanceHistory.create({
      data: {
        walletId,
        amount,
        balanceAfter: newBalance,
        reason: 'Deposit simulator'
      }
    });

    // Create a transaction log
    await prisma.transaction.create({
      data: {
        reference: `DEP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        senderWalletId: null,
        receiverWalletId: walletId,
        amount,
        currency: wallet.currency,
        status: 'confirmed',
        type: 'deposit',
        description: 'Simulated cash deposit'
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

    res.status(200).json(updatedWallet);
  } catch (error: any) {
    res.status(500).json({ error: 'Deposit failed', message: error.message });
  }
});

app.get('/transactions', async (req, res) => {
  const userId = getUserIdFromHeaders(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

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

// P2P Transfer (Atomically)
app.post('/transactions/transfer', async (req, res) => {
  const { senderWalletId, receiverEmail, amount, description } = req.body;
  const userId = getUserIdFromHeaders(req);

  if (!senderWalletId || !receiverEmail || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid transfer details' });
  }

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
    const senderWallet = await prisma.wallet.findUnique({ where: { id: senderWalletId } });
    if (!senderWallet) return res.status(404).json({ error: 'Sender wallet not found' });
    if (userId && senderWallet.userId !== userId) return res.status(403).json({ error: 'Unauthorized to spend from this wallet' });

    if (senderWallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // 2. Find receiver via Account Service
    // In local dev, we call account service profile search or profile endpoint. Let's make an internal REST call or direct DB if we know the URL.
    // Let's call the account service endpoint we'll create: GET http://localhost:8001/users/search-by-email?email=...
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

    // 4. Perform atomic double-entry bookkeeping in Prisma Transaction
    const [transaction] = await prisma.$transaction([
      // Create transaction log
      prisma.transaction.create({
        data: {
          reference,
          senderWalletId: senderWallet.id,
          receiverWalletId: receiverWallet.id,
          amount,
          currency: senderWallet.currency,
          status: 'confirmed',
          type: 'transfer',
          description: description || `Transfer to ${receiverEmail}`
        }
      }),
      // Debit sender
      prisma.wallet.update({
        where: { id: senderWallet.id },
        data: { balance: { decrement: amount } }
      }),
      prisma.balanceHistory.create({
        data: {
          walletId: senderWallet.id,
          amount: -amount,
          balanceAfter: senderWallet.balance - amount,
          reason: `Transfer to ${receiverEmail}`
        }
      }),
      // Credit receiver
      prisma.wallet.update({
        where: { id: receiverWallet.id },
        data: { balance: { increment: amount } }
      }),
      prisma.balanceHistory.create({
        data: {
          walletId: receiverWallet.id,
          amount,
          balanceAfter: receiverWallet.balance + amount,
          reason: `Transfer from ${senderWallet.userId}`
        }
      })
    ]);

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
        balance: senderWallet.balance - amount,
        currency: senderWallet.currency
      }
    });

    await publishEvent('wallet-transaction-service', {
      type: 'balance.updated',
      payload: {
        walletId: receiverWallet.id,
        userId: receiverWallet.userId,
        balance: receiverWallet.balance + amount,
        currency: receiverWallet.currency
      }
    });

    res.status(200).json({
      message: 'Transfer successful',
      transaction
    });
  } catch (error: any) {
    console.error('Transfer error:', error);
    res.status(500).json({ error: 'Transfer failed', message: error.message });
  }
});

// SEPA Pain.001 Credit Transfer Processing Endpoint (Validates XML input against custom XSD constraints)
app.post('/transactions/sepa-transfer', async (req, res) => {
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
    const senderWallet = await prisma.wallet.findUnique({ where: { iban: senderIban } });
    if (!senderWallet) {
      return res.status(404).json({ error: `SEPA processing aborted: Debtor account with IBAN ${senderIban} not found.` });
    }

    if (senderWallet.balance < amount) {
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

    // 5. Execute atomic double-entry bookkeeping ledger entry
    const [transaction] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          reference,
          senderWalletId: senderWallet.id,
          receiverWalletId: receiverWallet.id,
          amount,
          currency,
          status: 'confirmed',
          type: 'transfer',
          description: `SEPA: ${description}`
        }
      }),
      // Debit sender
      prisma.wallet.update({
        where: { id: senderWallet.id },
        data: { balance: { decrement: amount } }
      }),
      prisma.balanceHistory.create({
        data: {
          walletId: senderWallet.id,
          amount: -amount,
          balanceAfter: senderWallet.balance - amount,
          reason: `SEPA Credit Transfer out (Msg: ${validation.paymentInfo.msgId})`
        }
      }),
      // Credit receiver
      prisma.wallet.update({
        where: { id: receiverWallet.id },
        data: { balance: { increment: amount } }
      }),
      prisma.balanceHistory.create({
        data: {
          walletId: receiverWallet.id,
          amount,
          balanceAfter: receiverWallet.balance + amount,
          reason: `SEPA Credit Transfer in (Msg: ${validation.paymentInfo.msgId})`
        }
      })
    ]);

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
        balance: senderWallet.balance - amount,
        currency: senderWallet.currency
      }
    });

    await publishEvent('wallet-transaction-service', {
      type: 'balance.updated',
      payload: {
        walletId: receiverWallet.id,
        userId: receiverWallet.userId,
        balance: receiverWallet.balance + amount,
        currency: receiverWallet.currency
      }
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

app.listen(PORT, () => {
  console.log(`[Wallet & Transaction Service] running on http://localhost:${PORT}`);
});
