import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { publishEvent } from 'shared';

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 8003;
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:8002';
const ACCOUNT_SERVICE_URL = process.env.ACCOUNT_SERVICE_URL || 'http://localhost:8001';

app.use(cors());
app.use(express.json());

// Helper to get userId and email from headers/token
const getUserFromHeaders = (req: express.Request): { userId: string; email: string } | null => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;
  try {
    const payload: any = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return {
      userId: payload.userId || null,
      email: payload.email || null
    };
  } catch {
    return null;
  }
};

// Create an Invoice
app.post('/invoices', async (req, res) => {
  const user = getUserFromHeaders(req);
  if (!user || !user.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { recipientEmail, amount, description, dueDate } = req.body;

  if (!recipientEmail || !amount || amount <= 0 || !description || !dueDate) {
    return res.status(400).json({ error: 'Invalid invoice details' });
  }

  try {
    const invoice = await prisma.invoice.create({
      data: {
        userId: user.userId,
        creatorEmail: user.email,
        recipientEmail,
        amount: parseFloat(amount),
        description,
        dueDate,
        status: 'unpaid'
      }
    });

    console.log(`[Invoice Service] Invoice created: ${invoice.id} sent to ${recipientEmail}`);

    // Publish event: invoice.created so WS can push live notifications to recipient if online!
    await publishEvent('invoice-service', {
      type: 'payment.request', // reusing a standard payment request contract
      payload: {
        reference: `INV-${invoice.id.substring(0, 8).toUpperCase()}`,
        senderWalletId: invoice.id, // placeholder for identifier
        receiverWalletId: user.userId,
        amount: invoice.amount,
        currency: invoice.currency,
        description: `Factuur van ${user.email}: ${description}`
      }
    }, process.env.GATEWAY_URL);

    res.status(201).json(invoice);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create invoice', message: error.message });
  }
});

// Retrieve Invoices (sent by the user or received by the user)
app.get('/invoices', async (req, res) => {
  const user = getUserFromHeaders(req);
  if (!user || !user.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const invoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { userId: user.userId },          // Sent by user
          { recipientEmail: user.email }   // Received by user
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(invoices);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve invoices', message: error.message });
  }
});

// Pay Invoice (atomically via P2P transfers)
app.post('/invoices/:id/pay', async (req, res) => {
  const user = getUserFromHeaders(req);
  if (!user || !user.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.params;

  try {
    // 1. Find invoice
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Invoice has already been paid' });
    }

    if (invoice.recipientEmail !== user.email) {
      return res.status(403).json({ error: 'Forbidden: You are not the recipient of this invoice' });
    }

    // 2. Resolve the buyer's checking wallet via Wallet Service
    const authHeader = req.headers['authorization'];
    const walletsRes = await fetch(`${WALLET_SERVICE_URL}/wallets`, {
      headers: { 'Authorization': authHeader || '' }
    });

    if (!walletsRes.ok) {
      return res.status(500).json({ error: 'Failed to retrieve buyer wallets from Wallet Service' });
    }

    const wallets = await walletsRes.json();
    const buyerCheckingWallet = wallets.find((w: any) => w.type === 'checking' && w.currency === 'EUR');

    if (!buyerCheckingWallet) {
      return res.status(404).json({ error: 'Buyer does not have an active EUR checking account' });
    }

    if (buyerCheckingWallet.balance < invoice.amount) {
      return res.status(400).json({ error: 'Insufficient balance to pay this invoice' });
    }

    // 3. Atomically transfer money from buyer to seller checking wallet using P2P transfer route!
    const transferRes = await fetch(`${WALLET_SERVICE_URL}/transactions/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader || ''
      },
      body: JSON.stringify({
        senderWalletId: buyerCheckingWallet.id,
        receiverEmail: invoice.creatorEmail,
        amount: invoice.amount,
        description: `Betaling Factuur: ${invoice.description}`
      })
    });

    const transferData = await transferRes.json();

    if (!transferRes.ok) {
      return res.status(400).json({ error: transferData.error || 'Invoice payment transaction failed' });
    }

    // 4. Update invoice status to paid
    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: { status: 'paid' }
    });

    console.log(`[Invoice Service] Invoice ${invoice.id} paid successfully by ${user.email}`);

    res.status(200).json({
      message: 'Factuur succesvol betaald en verwerkt in de ledger.',
      invoice: updatedInvoice,
      transaction: transferData.transaction
    });

  } catch (error: any) {
    console.error('Invoice payment processing failure:', error);
    res.status(500).json({ error: 'Invoice payment failed', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`[Invoice Service] running on http://localhost:${PORT}`);
});
