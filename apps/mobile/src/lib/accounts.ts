// Saved accounts on this phone (#121) — pure list logic, no storage.
//
// The list only holds what the sign-in screen shows (name, email, whether
// biometric sign-in is linked). Secrets never live here: each account's
// biometric device credential is stored separately, behind the OS prompt
// (src/accounts.ts).

export interface SavedAccount {
  email: string;
  name: string;
  initials: string;
  /** Biometric sign-in is linked to this account on this phone. */
  biometric: boolean;
  /** The user said "not now" to linking biometrics for this account. */
  bioDismissed?: boolean;
  lastUsedAt: number;
}

export const MAX_SAVED_ACCOUNTS = 5;

const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** SecureStore keys may only contain [A-Za-z0-9._-]. */
export function accountStorageKey(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_');
}

export function initialsOf(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || email).slice(0, 2);
  return letters.toUpperCase();
}

/** Most recently used first. */
export function sortAccounts(list: SavedAccount[]): SavedAccount[] {
  return [...list].sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

/**
 * Adds or refreshes an account (matched case-insensitively by email), keeping
 * its biometric link unless `patch` says otherwise. Keeps at most
 * MAX_SAVED_ACCOUNTS, dropping the least recently used.
 */
export function upsertAccount(
  list: SavedAccount[],
  patch: Partial<SavedAccount> & { email: string },
  now = Date.now(),
): SavedAccount[] {
  const existing = list.find(a => sameEmail(a.email, patch.email));
  const name = patch.name ?? existing?.name ?? patch.email;
  const merged: SavedAccount = {
    email: patch.email.trim(),
    name,
    initials: patch.initials ?? initialsOf(name, patch.email),
    biometric: patch.biometric ?? existing?.biometric ?? false,
    bioDismissed: patch.bioDismissed ?? existing?.bioDismissed,
    lastUsedAt: patch.lastUsedAt ?? now,
  };
  const rest = list.filter(a => !sameEmail(a.email, patch.email));
  return sortAccounts([merged, ...rest]).slice(0, MAX_SAVED_ACCOUNTS);
}

/** Changes fields without touching lastUsedAt (e.g. linking biometrics). */
export function updateAccount(list: SavedAccount[], email: string, patch: Partial<SavedAccount>): SavedAccount[] {
  return list.map(a => (sameEmail(a.email, email) ? { ...a, ...patch, email: a.email } : a));
}

export function removeAccount(list: SavedAccount[], email: string): SavedAccount[] {
  return list.filter(a => !sameEmail(a.email, email));
}

export function findAccount(list: SavedAccount[], email: string | null | undefined): SavedAccount | undefined {
  return email ? list.find(a => sameEmail(a.email, email)) : undefined;
}

/** Tolerates missing, corrupt or older stored data. */
export function parseAccounts(raw: string | null): SavedAccount[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return sortAccounts(
      data
        .filter((a: any) => a && typeof a.email === 'string' && a.email.includes('@'))
        .map((a: any) => ({
          email: a.email,
          name: typeof a.name === 'string' && a.name ? a.name : a.email,
          initials: typeof a.initials === 'string' && a.initials ? a.initials : initialsOf(a.name || '', a.email),
          biometric: a.biometric === true,
          bioDismissed: a.bioDismissed === true || undefined,
          lastUsedAt: typeof a.lastUsedAt === 'number' ? a.lastUsedAt : 0,
        })),
    );
  } catch {
    return [];
  }
}
