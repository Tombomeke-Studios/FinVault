import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { 
  publishEvent, 
  requireAuth, 
  validateBody, 
  PaymentRequestSchema, 
  MandateSchema 
} from 'shared';
import { generateReceiptPdf } from './pdf-generator.js';

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 8003;
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:8002';
const ACCOUNT_SERVICE_URL = process.env.ACCOUNT_SERVICE_URL || 'http://localhost:8001';

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// =============================================
// Internal Service Authentication Helper
// =============================================
function requireInternalAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const serviceSecret = req.headers['x-service-secret'] as string;
  const expectedSecret = process.env.SERVICE_SECRET || 'finvault-internal-service-secret';
  if (serviceSecret !== expectedSecret) {
    return res.status(403).json({ error: 'Forbidden: Internal auth secret required' });
  }
  next();
}

// =============================================
// Receipts Endpoints (Kwitanties)
// =============================================

// Intern endpoint: Wallet Service roept dit aan om automatisch een kwitantie aan te maken
app.post('/receipts', async (req, res) => {
  const { transactionRef, payerUserId, payeeUserId, payerEmail, payeeEmail, amount, currency, description } = req.body;

  if (!transactionRef || !payerEmail || !amount || amount <= 0 || !description) {
    return res.status(400).json({ error: 'Invalid receipt payload' });
  }

  try {
    const existing = await prisma.receipt.findUnique({ where: { transactionRef } });
    if (existing) {
      return res.status(200).json(existing);
    }

    const receipt = await prisma.receipt.create({
      data: {
        transactionRef,
        payerUserId,
        payeeUserId,
        payerEmail,
        payeeEmail,
        amount: parseFloat(amount),
        currency: currency || 'EUR',
        description
      }
    });

    // Generate PDF asynchronously to keep request fast
    generateReceiptPdf(receipt)
      .then(async (filePath) => {
        await prisma.receipt.update({
          where: { id: receipt.id },
          data: { pdfPath: filePath }
        });
        console.log(`[Invoice Service] PDF Receipt generated for ${transactionRef}`);
      })
      .catch((err) => {
        console.error(`[Invoice Service] Failed to generate PDF for ${transactionRef}:`, err.message);
      });

    res.status(201).json(receipt);
  } catch (error: any) {
    console.error('Failed to create receipt:', error);
    res.status(500).json({ error: 'Failed to create receipt', message: error.message });
  }
});

// Haal alle kwitanties op van de ingelogde gebruiker (zowel betaald als ontvangen)
app.get('/receipts', requireAuth, async (req, res) => {
  const userId = (req as any).user.userId;

  try {
    const receipts = await prisma.receipt.findMany({
      where: {
        OR: [
          { payerUserId: userId },
          { payeeUserId: userId }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(receipts);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch receipts', message: error.message });
  }
});

// Download de PDF van een specifieke kwitantie
app.get('/receipts/:id/pdf', requireAuth, async (req, res) => {
  const userId = (req as any).user.userId;
  const { id } = req.params;

  try {
    const receipt = await prisma.receipt.findUnique({ where: { id } });
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    // Verify ownership
    if (receipt.payerUserId !== userId && receipt.payeeUserId !== userId) {
      return res.status(403).json({ error: 'Forbidden: You do not own this receipt' });
    }

    if (!receipt.pdfPath) {
      // Regenerate on the fly if missing
      const filePath = await generateReceiptPdf(receipt);
      await prisma.receipt.update({
        where: { id },
        data: { pdfPath: filePath }
      });
      return res.sendFile(filePath);
    }

    res.sendFile(receipt.pdfPath);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to download receipt', message: error.message });
  }
});

// =============================================
// Payment Requests Endpoints (Tikkie-model)
// =============================================

app.post('/payment-requests', requireAuth, async (req, res) => {
  const { userId, email } = (req as any).user;

  const body = validateBody(PaymentRequestSchema, req, res);
  if (!body) return;

  const { recipientEmail, amount, description } = body;

  if (recipientEmail === email) {
    return res.status(400).json({ error: 'Cannot request money from yourself' });
  }

  try {
    const request = await prisma.paymentRequest.create({
      data: {
        creatorUserId: userId,
        creatorEmail: email,
        recipientEmail,
        amount,
        description,
        status: 'pending'
      }
    });

    console.log(`[Invoice Service] Payment Request created: ${request.id} sent to ${recipientEmail}`);

    // Publish event for live UI notification
    await publishEvent('invoice-service', {
      type: 'payment.request',
      payload: {
        reference: `REQ-${request.id.substring(0, 8).toUpperCase()}`,
        senderWalletId: request.id,
        receiverWalletId: userId,
        amount,
        currency: 'EUR',
        description: `Betalingsverzoek van ${email}: ${description}`
      }
    }, process.env.GATEWAY_URL);

    res.status(201).json(request);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create payment request', message: error.message });
  }
});

// Haal alle verzoeken op (verzonden en ontvangen)
app.get('/payment-requests', requireAuth, async (req, res) => {
  const { userId, email } = (req as any).user;

  try {
    const requests = await prisma.paymentRequest.findMany({
      where: {
        OR: [
          { creatorUserId: userId },
          { recipientEmail: email }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(requests);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve payment requests', message: error.message });
  }
});

// Betalen van betalingsverzoek (atomaire P2P transfer via Wallet Service)
app.post('/payment-requests/:id/pay', requireAuth, async (req, res) => {
  const { userId, email } = (req as any).user;
  const { id } = req.params;
  const authHeader = req.headers['authorization'] || '';

  try {
    const request = await prisma.paymentRequest.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: 'Payment request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'This payment request is no longer pending' });
    }

    if (request.recipientEmail !== email) {
      return res.status(403).json({ error: 'Forbidden: You are not the recipient of this request' });
    }

    // Resolve buyer checking account
    const walletsRes = await fetch(`${WALLET_SERVICE_URL}/wallets`, {
      headers: { 'Authorization': authHeader }
    });

    if (!walletsRes.ok) {
      return res.status(500).json({ error: 'Failed to fetch checking account from Wallet Service' });
    }

    const wallets = await walletsRes.json();
    const buyerCheckingWallet = wallets.find((w: any) => w.type === 'checking' && w.currency === 'EUR');

    if (!buyerCheckingWallet) {
      return res.status(404).json({ error: 'No active EUR checking account found' });
    }

    let availableCredit = 0.0;
    if (buyerCheckingWallet.creditLine && ['active', 'suspended'].includes(buyerCheckingWallet.creditLine.status)) {
      availableCredit = buyerCheckingWallet.creditLine.creditLimit - buyerCheckingWallet.creditLine.usedCredit;
    }

    if (buyerCheckingWallet.balance + availableCredit < request.amount) {
      return res.status(400).json({ error: 'Insufficient balance to satisfy this payment request' });
    }

    // Execute atomic P2P transfer
    const transferRes = await fetch(`${WALLET_SERVICE_URL}/transactions/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        senderWalletId: buyerCheckingWallet.id,
        receiverEmail: request.creatorEmail,
        amount: request.amount,
        description: `Voldaan betalingsverzoek: ${request.description}`
      })
    });

    const transferData = await transferRes.json();
    if (!transferRes.ok) {
      return res.status(400).json({ error: transferData.error || 'Transaction failed' });
    }

    // Update Request status
    const updatedRequest = await prisma.paymentRequest.update({
      where: { id },
      data: {
        status: 'paid',
        paidAt: new Date(),
        transactionRef: transferData.transaction.reference
      }
    });

    res.status(200).json({
      message: 'Betalingsverzoek succesvol voldaan.',
      request: updatedRequest,
      transaction: transferData.transaction
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to satisfy payment request', message: error.message });
  }
});

// Weigeren van betalingsverzoek
app.post('/payment-requests/:id/decline', requireAuth, async (req, res) => {
  const { email } = (req as any).user;
  const { id } = req.params;

  try {
    const request = await prisma.paymentRequest.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: 'Payment request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Payment request is not pending' });
    }

    if (request.recipientEmail !== email) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updatedRequest = await prisma.paymentRequest.update({
      where: { id },
      data: { status: 'declined' }
    });

    res.status(200).json({ message: 'Betalingsverzoek geweigerd.', request: updatedRequest });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to decline request', message: error.message });
  }
});

// =============================================
// Mandates Endpoints (Automatische Incasso)
// =============================================

app.post('/mandates', requireAuth, async (req, res) => {
  const { userId, email } = (req as any).user;

  const body = validateBody(MandateSchema, req, res);
  if (!body) return;

  const { payeeEmail, amount, description, intervalDays } = body;

  if (payeeEmail === email) {
    return res.status(400).json({ error: 'Cannot set up a mandate to pay yourself' });
  }

  try {
    // Resolve payee userId via Account Service
    const userRes = await fetch(`${ACCOUNT_SERVICE_URL}/users/profile-by-email?email=${encodeURIComponent(payeeEmail)}`);
    if (!userRes.ok) {
      return res.status(404).json({ error: `No FinVault user found with email: ${payeeEmail}` });
    }

    const payeeData = await userRes.json();
    const resolvedIntervalDays = intervalDays ?? 30;
    const nextChargeAt = new Date(Date.now() + resolvedIntervalDays * 24 * 60 * 60 * 1000);

    const mandate = await prisma.mandate.create({
      data: {
        payerUserId: userId,
        payerEmail: email,
        payeeUserId: payeeData.id,
        payeeEmail,
        amount,
        description,
        intervalDays: resolvedIntervalDays,
        status: 'active',
        nextChargeAt
      }
    });

    res.status(201).json(mandate);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to set up mandate', message: error.message });
  }
});

// Haal actieve mandaten op
app.get('/mandates', requireAuth, async (req, res) => {
  const userId = (req as any).user.userId;

  try {
    const mandates = await prisma.mandate.findMany({
      where: {
        OR: [
          { payerUserId: userId },
          { payeeUserId: userId }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(mandates);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve mandates', message: error.message });
  }
});

// Annuleren van mandaat
app.post('/mandates/:id/cancel', requireAuth, async (req, res) => {
  const userId = (req as any).user.userId;
  const { id } = req.params;

  try {
    const mandate = await prisma.mandate.findUnique({ where: { id } });
    if (!mandate) {
      return res.status(404).json({ error: 'Mandate not found' });
    }

    // Only payer can cancel a mandate
    if (mandate.payerUserId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await prisma.mandate.update({
      where: { id },
      data: { status: 'cancelled' }
    });

    res.status(200).json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to cancel mandate', message: error.message });
  }
});

// Intern endpoint: Verwerk alle openstaande mandaten (tijdsimulatie)
app.post('/mandates/process-charges', requireInternalAuth, async (req, res) => {
  try {
    const now = new Date();
    const activeMandates = await prisma.mandate.findMany({
      where: {
        status: 'active',
        nextChargeAt: { lte: now }
      }
    });

    console.log(`[Invoice Service] Processing ${activeMandates.length} mandate charges...`);

    for (const mandate of activeMandates) {
      const reference = `MND-${mandate.id.substring(0, 4).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      try {
        // Execute internal transfer via Wallet Service
        const transferRes = await fetch(`${WALLET_SERVICE_URL}/transactions/internal-transfer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Secret': process.env.SERVICE_SECRET || 'finvault-internal-service-secret'
          },
          body: JSON.stringify({
            senderUserId: mandate.payerUserId,
            receiverUserId: mandate.payeeUserId,
            amount: mandate.amount,
            description: `Mandaat afschrijving: ${mandate.description}`,
            reference
          })
        });

        const transferData = await transferRes.json();

        if (transferRes.ok) {
          // Calculate next charge date
          const nextChargeAt = new Date(mandate.nextChargeAt.getTime() + mandate.intervalDays * 24 * 60 * 60 * 1000);

          await prisma.mandate.update({
            where: { id: mandate.id },
            data: {
              lastChargedAt: now,
              nextChargeAt,
              totalCharged: mandate.totalCharged + mandate.amount,
              chargeCount: mandate.chargeCount + 1
            }
          });

          // Generate Receipt record and PDF immediately
          const receipt = await prisma.receipt.create({
            data: {
              transactionRef: reference,
              payerUserId: mandate.payerUserId,
              payeeUserId: mandate.payeeUserId,
              payerEmail: mandate.payerEmail,
              payeeEmail: mandate.payeeEmail,
              amount: mandate.amount,
              currency: 'EUR',
              description: `Automatische Incasso: ${mandate.description}`
            }
          });

          generateReceiptPdf(receipt)
            .then(async (filePath) => {
              await prisma.receipt.update({
                where: { id: receipt.id },
                data: { pdfPath: filePath }
              });
            })
            .catch((err) => {
              console.error(`[Invoice Service] Mandate receipt PDF error:`, err.message);
            });

          console.log(`[Invoice Service] Mandate ${mandate.id} successfully charged.`);
        } else {
          console.error(`[Invoice Service] Mandate ${mandate.id} charge failed:`, transferData.error);
        }
      } catch (err: any) {
        console.error(`[Invoice Service] Failed to charge mandate ${mandate.id}:`, err.message);
      }
    }

    res.status(200).json({ status: 'processed', count: activeMandates.length });
  } catch (error: any) {
    res.status(500).json({ error: 'Mandate processing failed', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`[Invoice Service] running on http://localhost:${PORT}`);
});
