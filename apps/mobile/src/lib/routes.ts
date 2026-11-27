// Which way a screen change should move (#125). Tabs slide in from the side
// you are heading to, like a horizontal pager: Home → Goals comes in from the
// right, Goals → Home from the left. Pages below the tabs (settings, a single
// account, notifications…) push in from the right and slide back out to it.

export const TAB_ORDER = ['overview', 'transactions', 'transfer', 'analytics', 'savings'] as const;

/** The bottom tab a route belongs to, or null for pages outside the tabs. */
export function tabOf(route: string): string | null {
  if (route.startsWith('account:')) return 'overview';
  return (TAB_ORDER as readonly string[]).includes(route) ? route : null;
}

/** 1 = enter from the right, -1 = enter from the left, 0 = no slide. */
export function routeDirection(prev: string, next: string): 1 | -1 | 0 {
  if (prev === next) return 0;
  const a = tabOf(prev), b = tabOf(next);
  if (a && b && a !== b) return TAB_ORDER.indexOf(b as any) > TAB_ORDER.indexOf(a as any) ? 1 : -1;
  if (a && b) return 1;           // inside one tab (Home → account page) goes deeper
  if (!b) return 1;               // into a page outside the tabs
  return -1;                      // back from such a page to a tab
}
