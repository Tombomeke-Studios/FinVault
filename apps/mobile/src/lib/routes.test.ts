import { describe, expect, it } from 'vitest';
import { routeDirection, tabOf } from './routes';

describe('tabOf', () => {
  it('maps account pages to Home and other pages to no tab', () => {
    expect(tabOf('overview')).toBe('overview');
    expect(tabOf('account:abc')).toBe('overview');
    expect(tabOf('settings')).toBeNull();
  });
});

describe('routeDirection', () => {
  it('slides between tabs in tab order', () => {
    expect(routeDirection('overview', 'savings')).toBe(1);
    expect(routeDirection('savings', 'transactions')).toBe(-1);
  });

  it('pushes deeper pages in from the right and returns from the left', () => {
    expect(routeDirection('overview', 'settings')).toBe(1);
    expect(routeDirection('overview', 'account:w1')).toBe(1);
    expect(routeDirection('settings', 'notifications')).toBe(1);
    expect(routeDirection('settings', 'overview')).toBe(-1);
  });

  it('does not move when the route did not change', () => {
    expect(routeDirection('overview', 'overview')).toBe(0);
  });
});
