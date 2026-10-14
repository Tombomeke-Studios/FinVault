import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

export type FinVaultEvent =
  | { type: 'account.created'; payload: { userId: string; email: string; accountType: string } }
  | { type: 'account.updated'; payload: { userId: string; email: string } }
  | { type: 'account.frozen'; payload: { userId: string; reason: string } }
  | { type: 'card.created'; payload: { cardId: string; userId: string; walletId: string; name: string; last4: string } }
  | { type: 'balance.updated'; payload: { walletId: string; userId: string; balance: number; currency: string } }
  | { type: 'balance.low'; payload: { walletId: string; userId: string; balance: number; currency: string } }
  // `customerEmail` is set by an external requester (NexusInfra's hosted edition):
  // it names who should pay in a way FinVault can resolve, which a wallet id from
  // another system is not.
  | { type: 'payment.request'; payload: { reference: string; senderWalletId: string; receiverWalletId: string; amount: number; currency: string; description: string; customerEmail?: string } }
  | { type: 'payment.processing'; payload: { transactionId: string; reference: string } }
  | { type: 'payment.confirmed'; payload: { transactionId: string; reference: string; amount: number; senderWalletId: string; receiverWalletId: string } }
  | { type: 'payment.failed'; payload: { transactionId: string; reference: string; reason: string } };

export interface EventEnvelope<T extends FinVaultEvent = FinVaultEvent> {
  eventId: string;
  timestamp: string;
  source: string;
  event: T;
}

// ── AES-256-GCM payload encryption ────────────────────────────────────────────
// When FINVAULT_MESSAGE_KEY is set, event payloads are encrypted before transit.
// The event `type` stays readable (needed for routing); only the `payload` is
// replaced with { encrypted: true, data: '<base64 ciphertext>' }.
// Consuming services call decryptPayload(event.payload.data) to recover the data.

const ALGORITHM = 'aes-256-gcm';
const KDF_SALT  = 'finvault-events-v1'; // fixed public salt; entropy comes from the key

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, KDF_SALT, 32);
}

export function encryptPayload(payload: Record<string, unknown>, secret: string): string {
  const key = deriveKey(secret);
  const iv  = randomBytes(12); // 96-bit IV — GCM standard
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const pt = Buffer.from(JSON.stringify(payload), 'utf8');
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag(); // 128-bit auth tag
  // Layout: iv(12) | tag(16) | ciphertext
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptPayload(ciphertext: string, secret: string): Record<string, unknown> {
  const key = deriveKey(secret);
  const buf  = Buffer.from(ciphertext, 'base64');
  const iv   = buf.subarray(0, 12);
  const tag  = buf.subarray(12, 28);
  const ct   = buf.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(pt.toString('utf8'));
}

/**
 * The payload of a received event, decrypted when it arrived encrypted.
 *
 * Throws when the payload is encrypted and no key is configured, or the key is
 * wrong — a consumer then dead-letters the message instead of acting on
 * ciphertext as if it were data.
 */
export function readEventPayload<T = Record<string, unknown>>(event: { payload: unknown }, secret = process.env.FINVAULT_MESSAGE_KEY): T {
  const payload = event.payload as { encrypted?: boolean; data?: string } | null;
  if (payload && payload.encrypted === true && typeof payload.data === 'string') {
    if (!secret) throw new Error('received an encrypted payload but FINVAULT_MESSAGE_KEY is not set');
    return decryptPayload(payload.data, secret) as T;
  }
  return event.payload as T;
}

/**
 * Publishes an event to the API Gateway Event Hub.
 *
 * When FINVAULT_MESSAGE_KEY is set the event payload is AES-256-GCM encrypted
 * before sending. The event type remains plain so the gateway can route it; the
 * encrypted payload can only be read by services that hold the same key.
 */
export async function publishEvent(
  source: string,
  event: FinVaultEvent,
  gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:8000'
): Promise<boolean> {
  const messageKey = process.env.FINVAULT_MESSAGE_KEY;

  const securedEvent: FinVaultEvent = messageKey
    ? { type: event.type, payload: { encrypted: true, data: encryptPayload(event.payload as Record<string, unknown>, messageKey) } } as unknown as FinVaultEvent
    : event;

  const envelope: EventEnvelope = {
    eventId: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
    timestamp: new Date().toISOString(),
    source,
    event: securedEvent,
  };

  const serviceSecret = process.env.SERVICE_SECRET || 'finvault-internal-service-secret';

  try {
    const res = await fetch(`${gatewayUrl}/api/events/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Secret': serviceSecret
      },
      body: JSON.stringify(envelope)
    });

    if (res.ok) {
      console.log(`[EventClient] Published ${event.type}${messageKey ? ' (encrypted)' : ''}`);
      return true;
    } else {
      console.error(`[EventClient] Failed to publish ${event.type}: ${res.statusText}`);
      return false;
    }
  } catch (error: any) {
    console.error(`[EventClient] Error publishing ${event.type}:`, error.message);
    return false;
  }
}
