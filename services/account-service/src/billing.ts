// Subscription billing (#119) — pure rules, no I/O.
//
// Prices live here, never on the client: the app sends a plan *name* and the
// server decides what it costs. Standard is free; Metal and Metal+ are billed
// monthly from the customer's EUR checking wallet.

export const PLAN_PRICES = {
  Standard: 0,
  Metal: 9.99,
  'Metal+': 16.99,
} as const;

export type PlanName = keyof typeof PLAN_PRICES;

export function isPlanName(value: unknown): value is PlanName {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PLAN_PRICES, value);
}

export function planPrice(plan: string): number {
  return isPlanName(plan) ? PLAN_PRICES[plan] : 0;
}

/** Same day next month, clamped to the month's last day (31 Jan → 28/29 Feb). */
export function addOneMonth(from: Date): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export interface PlanChange {
  /** Amount to charge now (EUR, 2 decimals); 0 = nothing to charge. */
  charge: number;
  /** Next renewal after the change; null = no renewals (Standard). */
  renewsAt: Date | null;
}

/**
 * What switching from `current` to `next` costs today.
 *
 * - To Standard: nothing is charged or refunded and renewals stop.
 * - Into a paid plan without an active billing period (from Standard, or a
 *   legacy free Metal account whose `renewsAt` is null): the full month is
 *   charged and the period starts today.
 * - Between paid plans inside a period: an upgrade charges the price
 *   difference, a downgrade charges nothing; the renewal date stays, and the
 *   next renewal bills the new plan's price.
 */
export function planChange(current: string, next: PlanName, renewsAt: Date | null, now: Date): PlanChange {
  if (next === 'Standard') return { charge: 0, renewsAt: null };

  const activePeriod = planPrice(current) > 0 && renewsAt !== null && renewsAt.getTime() > now.getTime();
  if (!activePeriod) return { charge: PLAN_PRICES[next], renewsAt: addOneMonth(now) };

  const diff = Math.round((PLAN_PRICES[next] - planPrice(current)) * 100) / 100;
  return { charge: Math.max(0, diff), renewsAt };
}

/**
 * Stable reference for one plan charge. The wallet ledger has a unique
 * reference, so retrying the same charge (a renewal job that runs twice, a
 * double-tapped upgrade) can never bill the customer twice.
 */
export function chargeReference(userId: string, kind: 'start' | 'upgrade' | 'renewal', plan: PlanName, periodStart: Date): string {
  const day = periodStart.toISOString().slice(0, 10).replace(/-/g, '');
  const p = plan === 'Metal+' ? 'METALPLUS' : plan.toUpperCase();
  return `SUB-${kind.toUpperCase()}-${p}-${day}-${userId.replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}
