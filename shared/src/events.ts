export type FinVaultEvent =
  | { type: 'account.created'; payload: { userId: string; email: string; accountType: string } }
  | { type: 'account.updated'; payload: { userId: string; email: string } }
  | { type: 'account.frozen'; payload: { userId: string; reason: string } }
  | { type: 'balance.updated'; payload: { walletId: string; userId: string; balance: number; currency: string } }
  | { type: 'balance.low'; payload: { walletId: string; userId: string; balance: number; currency: string } }
  | { type: 'payment.request'; payload: { reference: string; senderWalletId: string; receiverWalletId: string; amount: number; currency: string; description: string } }
  | { type: 'payment.processing'; payload: { transactionId: string; reference: string } }
  | { type: 'payment.confirmed'; payload: { transactionId: string; reference: string; amount: number; senderWalletId: string; receiverWalletId: string } }
  | { type: 'payment.failed'; payload: { transactionId: string; reference: string; reason: string } };

export interface EventEnvelope<T extends FinVaultEvent = FinVaultEvent> {
  eventId: string;
  timestamp: string;
  source: string;
  event: T;
}

/**
 * Publishes an event to the API Gateway Event Hub
 */
export async function publishEvent(
  source: string,
  event: FinVaultEvent,
  gatewayUrl = 'http://localhost:8000'
): Promise<boolean> {
  const envelope: EventEnvelope = {
    eventId: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
    timestamp: new Date().toISOString(),
    source,
    event
  };

  try {
    const res = await fetch(`${gatewayUrl}/api/events/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(envelope)
    });

    if (res.ok) {
      console.log(`[EventClient] Successfully published ${event.type}`);
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
