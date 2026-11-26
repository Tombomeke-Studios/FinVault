// Live updates from the gateway's WebSocket hub (#107). Pure, unit-tested; the
// connection itself lives in App.tsx.
//
// The web dashboard has listened to this hub from the start. The mobile app did
// not, so a balance only changed after a pull-to-refresh: paying a payment
// request, or receiving money, looked like nothing had happened.

/** The hub's address for an API base URL: same host and port, ws(s) scheme, token in the query. */
export function liveSocketUrl(apiUrl: string, token: string): string | null {
  const match = /^(https?):\/\/([^/?#]+)/i.exec((apiUrl || '').trim());
  if (!match || !token) return null;
  const scheme = match[1].toLowerCase() === 'https' ? 'wss' : 'ws';
  return `${scheme}://${match[2]}/?token=${encodeURIComponent(token)}`;
}

export type LiveAction =
  /** One wallet's new balance, as the ledger wrote it. */
  | { kind: 'balance'; walletId: string; balance: number }
  /** Something moved money: fetch wallets and transactions again. */
  | { kind: 'reload' };

/**
 * What a hub message means for this app, or null for anything else. The gateway
 * sends `payment.confirmed` to every connected user (#108), so it only ever
 * triggers a reload of this user's own data, never anything shown about it.
 */
export function liveAction(raw: unknown): LiveAction | null {
  if (typeof raw !== 'string') return null;
  let message: any;
  try {
    message = JSON.parse(raw);
  } catch {
    return null;
  }
  const type = message?.event?.type;
  const payload = message?.event?.payload;
  if (type === 'balance.updated') {
    if (typeof payload?.walletId !== 'string' || typeof payload?.balance !== 'number' || !Number.isFinite(payload.balance)) return null;
    return { kind: 'balance', walletId: payload.walletId, balance: payload.balance };
  }
  if (type === 'payment.confirmed') return { kind: 'reload' };
  return null;
}

/** `wallets` with one wallet's balance replaced; the same array when that wallet is not there. */
export function withBalance<W extends { id: string; balance: number }>(wallets: W[], walletId: string, balance: number): W[] {
  if (!wallets.some((w) => w.id === walletId)) return wallets;
  return wallets.map((w) => (w.id === walletId ? { ...w, balance } : w));
}

/** Wait before reconnect attempt `attempt` (0-based): 1 s, doubling, capped at 30 s. */
export function reconnectDelayMs(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** Math.max(0, attempt));
}
