import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { EventEnvelope } from 'shared';

dotenv.config();

const PORT = process.env.PORT || 8000;
const ACCOUNT_SERVICE_URL = process.env.ACCOUNT_SERVICE_URL || 'http://localhost:8001';
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:8002';
const INVOICE_SERVICE_URL = process.env.INVOICE_SERVICE_URL || 'http://localhost:8003';

const app = express();
app.use(cors());
app.use(express.json());

// Proxy helper function
const proxyTo = (targetUrl: string) => async (req: express.Request, res: express.Response) => {
  const url = `${targetUrl}${req.originalUrl.replace('/api', '')}`;
  try {
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization ? { 'Authorization': req.headers.authorization } : {})
      },
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error: any) {
    console.error(`Proxy error for ${url}:`, error.message);
    res.status(502).json({ error: 'Bad Gateway', message: error.message });
  }
};

// Route mapping
app.use('/api/auth', proxyTo(ACCOUNT_SERVICE_URL));
app.use('/api/users', proxyTo(ACCOUNT_SERVICE_URL));
app.use('/api/wallets', proxyTo(WALLET_SERVICE_URL));
app.use('/api/transactions', proxyTo(WALLET_SERVICE_URL));
app.use('/api/invoices', proxyTo(INVOICE_SERVICE_URL));

// Simple Webhook Registration for Microservices
interface WebhookSubscription {
  serviceName: string;
  url: string;
  events: string[];
}

const subscriptions: WebhookSubscription[] = [
  {
    serviceName: 'wallet-transaction-service',
    url: `${WALLET_SERVICE_URL}/webhooks/events`,
    events: ['account.created', 'account.frozen']
  }
];

// Event Hub endpoint
app.post('/api/events/publish', async (req, res) => {
  const envelope = req.body as EventEnvelope;
  console.log(`[Event Hub] Received event: ${envelope.event.type} from ${envelope.source}`);

  // 1. Broadcast to subscribed microservices
  for (const sub of subscriptions) {
    if (sub.events.includes(envelope.event.type) || sub.events.includes('*')) {
      fetch(sub.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope)
      }).catch(err => {
        console.error(`[Event Hub] Failed to dispatch to ${sub.serviceName}:`, err.message);
      });
    }
  }

  // 2. Broadcast to connected WebSocket clients (dashboard)
  broadcastToWebSockets(envelope);

  res.status(200).json({ status: 'published', eventId: envelope.eventId });
});

// Create HTTP server
const server = createServer(app);

// WebSocket Server for Clients
const wss = new WebSocketServer({ server });
const clientConnections = new Map<string, WebSocket>(); // userId -> WS connection

wss.on('connection', (ws, req) => {
  const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
  const userId = urlParams.get('userId');

  if (!userId) {
    ws.close(4001, 'Unauthorized: userId required');
    return;
  }

  clientConnections.set(userId, ws);
  console.log(`[WebSocket] Client connected: ${userId}`);

  ws.on('close', () => {
    clientConnections.delete(userId);
    console.log(`[WebSocket] Client disconnected: ${userId}`);
  });
});

// WebSocket Broadcast helper
function broadcastToWebSockets(envelope: EventEnvelope) {
  const event = envelope.event;
  console.log(`[WebSocket] Broadcasting event ${event.type}`);

  // Broadcast to specific user or all depending on the event
  if (event.type === 'balance.updated' || event.type === 'balance.low') {
    const ws = clientConnections.get(event.payload.userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(envelope));
    }
  } else if (event.type === 'payment.confirmed' || event.type === 'payment.failed') {
    // Alert the sender and receiver if they are online
    // Wait, the payload has senderWalletId and receiverWalletId, we can lookup users via wallet service in real scenario,
    // or just broadcast to everyone for local simulation, or extract userId from the payload if we passed it.
    // For ease, let's broadcast to all active connections so everyone sees it (simulating live banking environment)
    for (const [userId, ws] of clientConnections.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(envelope));
      }
    }
  } else {
    // Generic broadcast to everyone
    for (const [userId, ws] of clientConnections.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(envelope));
      }
    }
  }
}

server.listen(PORT, () => {
  console.log(`[API Gateway] running on http://localhost:${PORT}`);
});
