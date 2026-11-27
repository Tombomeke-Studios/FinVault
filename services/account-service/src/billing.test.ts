import { describe, expect, it } from 'vitest';
import { addOneMonth, chargeReference, isPlanName, planChange, planPrice } from './billing.js';

const NOW = new Date('2026-11-27T10:00:00Z');

describe('plan prices', () => {
  it('knows the three plans and nothing else', () => {
    expect(isPlanName('Metal+')).toBe(true);
    expect(isPlanName('Gold')).toBe(false);
    expect(isPlanName('toString')).toBe(false);
    expect(planPrice('Standard')).toBe(0);
    expect(planPrice('Metal')).toBe(9.99);
    expect(planPrice('Metal+')).toBe(16.99);
  });
});

describe('addOneMonth', () => {
  it('keeps the day of month', () => {
    expect(addOneMonth(NOW).toISOString()).toBe('2026-12-27T10:00:00.000Z');
  });

  it('clamps to the last day of a shorter month', () => {
    expect(addOneMonth(new Date('2027-01-31T00:00:00Z')).toISOString()).toBe('2027-02-28T00:00:00.000Z');
  });

  it('rolls over the year', () => {
    expect(addOneMonth(new Date('2026-12-15T00:00:00Z')).toISOString()).toBe('2027-01-15T00:00:00.000Z');
  });
});

describe('planChange', () => {
  it('charges the full month when starting a paid plan from Standard', () => {
    const c = planChange('Standard', 'Metal', null, NOW);
    expect(c.charge).toBe(9.99);
    expect(c.renewsAt?.toISOString()).toBe('2026-12-27T10:00:00.000Z');
  });

  it('treats a legacy free paid plan (no renewal date) as a new subscription', () => {
    expect(planChange('Metal', 'Metal+', null, NOW).charge).toBe(16.99);
  });

  it('charges only the difference for an upgrade inside the period, keeping the date', () => {
    const renews = new Date('2026-12-10T00:00:00Z');
    const c = planChange('Metal', 'Metal+', renews, NOW);
    expect(c.charge).toBe(7);
    expect(c.renewsAt).toBe(renews);
  });

  it('charges nothing for a downgrade inside the period', () => {
    const renews = new Date('2026-12-10T00:00:00Z');
    expect(planChange('Metal+', 'Metal', renews, NOW)).toEqual({ charge: 0, renewsAt: renews });
  });

  it('stops renewals when moving to Standard', () => {
    expect(planChange('Metal+', 'Standard', new Date('2026-12-10T00:00:00Z'), NOW)).toEqual({ charge: 0, renewsAt: null });
  });

  it('starts a new period when the old one already lapsed', () => {
    const c = planChange('Metal', 'Metal+', new Date('2026-11-01T00:00:00Z'), NOW);
    expect(c.charge).toBe(16.99);
    expect(c.renewsAt?.toISOString()).toBe('2026-12-27T10:00:00.000Z');
  });
});

describe('chargeReference', () => {
  it('is stable for the same charge and distinct per period and kind', () => {
    const id = '3f2a9c1e-1234-4bcd-8ef0-1234567890ab';
    const a = chargeReference(id, 'renewal', 'Metal', new Date('2026-12-27T10:00:00Z'));
    expect(a).toBe(chargeReference(id, 'renewal', 'Metal', new Date('2026-12-27T23:00:00Z')));
    expect(a).not.toBe(chargeReference(id, 'renewal', 'Metal', new Date('2027-01-27T10:00:00Z')));
    expect(a).not.toBe(chargeReference(id, 'upgrade', 'Metal', new Date('2026-12-27T10:00:00Z')));
    expect(a).toMatch(/^SUB-RENEWAL-METAL-20261227-3F2A9C1E1234$/);
  });
});
