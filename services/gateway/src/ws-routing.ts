// Who receives an event over the WebSocket hub (#108).
//
// The hub used to send payment.confirmed / payment.failed — amount, reference,
// both wallet ids — to every connected user, and every other event type too.
// The web dashboard shows each payment.confirmed as a toast, so every signed-in
// user saw every other user's payments as they happened.
//
// Now an event goes only to the users it names. A type this table does not know,
// or one that names nobody, goes to nobody: the clients only act on
// balance.updated and payment.confirmed, and a new event type has to be routed
// here on purpose before anyone receives it.

interface RoutableEvent {
  type: string;
  payload?: unknown;
}

function stringsOf(payload: unknown, keys: string[]): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  return keys.map((key) => record[key]).filter((value): value is string => typeof value === 'string' && value.length > 0);
}

/** The user ids that may receive `event`, without duplicates; empty means nobody. */
export function recipientsOf(event: RoutableEvent): string[] {
  switch (event.type) {
    case 'balance.updated':
    case 'balance.low':
      return [...new Set(stringsOf(event.payload, ['userId']))];
    case 'payment.confirmed':
    case 'payment.failed':
      return [...new Set(stringsOf(event.payload, ['senderUserId', 'receiverUserId']))];
    default:
      return [];
  }
}
