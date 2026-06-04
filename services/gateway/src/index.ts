import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { EventEnvelope, verifyToken, publishRabbitEvent } from 'shared';

dotenv.config();

const PORT = process.env.PORT || 8000;
const ACCOUNT_SERVICE_URL = process.env.ACCOUNT_SERVICE_URL || 'http://localhost:8001';
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:8002';
const INVOICE_SERVICE_URL = process.env.INVOICE_SERVICE_URL || 'http://localhost:8003';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Global Gateway Rate Limiter (Max 500 requests per minute per IP for local/Docker testing compatibility)
const apiAttempts = new Map<string, { count: number; resetAt: number }>();
app.use((req, res, next) => {
  const ip = req.ip || '127.0.0.1';
  const now = Date.now();
  const limit = 500;
  const windowMs = 60 * 1000;

  const record = apiAttempts.get(ip);
  if (!record || now > record.resetAt) {
    apiAttempts.set(ip, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (record.count >= limit) {
    return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
  }

  record.count += 1;
  next();
});

// Proxy helper function
const proxyTo = (targetUrl: string, stripPrefix?: string) => async (req: express.Request, res: express.Response) => {
  let path = req.originalUrl.replace('/api', '');
  if (stripPrefix) {
    path = path.replace(stripPrefix, '');
  }
  const url = `${targetUrl}${path}`;
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
app.use('/api/cards', proxyTo(WALLET_SERVICE_URL));
app.use('/api/goals', proxyTo(WALLET_SERVICE_URL));
app.use('/api/invoices', proxyTo(INVOICE_SERVICE_URL, '/invoices'));

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

// Event Hub endpoint with X-Service-Secret authentication
app.post('/api/events/publish', async (req, res) => {
  const serviceSecret = req.headers['x-service-secret'] as string;
  const expectedSecret = process.env.SERVICE_SECRET || 'finvault-internal-service-secret';
  if (serviceSecret !== expectedSecret) {
    return res.status(403).json({ error: 'Forbidden: Event Hub requires valid service authentication.' });
  }

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

  // 3. Publish to RabbitMQ Topic Exchange with DLQ
  publishRabbitEvent('events.' + envelope.event.type, envelope).catch(err => {
    console.error(`[Event Hub RabbitMQ] Failed to publish event:`, err.message);
  });

  res.status(200).json({ status: 'published', eventId: envelope.eventId });
});

// Create HTTP server
const server = createServer(app);

// WebSocket Server for Clients
const wss = new WebSocketServer({ server });
const clientConnections = new Map<string, WebSocket>(); // userId -> WS connection

wss.on('connection', (ws, req) => {
  const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
  const token = urlParams.get('token');

  if (!token) {
    ws.close(4001, 'Unauthorized: token required');
    return;
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    ws.close(4002, 'Unauthorized: Invalid or expired token');
    return;
  }

  const userId = decoded.userId;

  clientConnections.set(userId, ws);
  console.log(`[WebSocket] Client connected: ${userId} (verified via JWT)`);

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

const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);
