import React, { useState, useCallback, useEffect, Component } from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity, Text, StatusBar, TextInput, Alert, Platform, BackHandler } from 'react-native';
import { ScreenAuth } from './src/screens/ScreenAuth';
import { ScreenOverview } from './src/screens/ScreenOverview';
import { ScreenTransactions } from './src/screens/ScreenTransactions';
import { ScreenTransfer } from './src/screens/ScreenTransfer';
import { ScreenCards } from './src/screens/ScreenCards';
import { ScreenSavings } from './src/screens/ScreenSavings';
import { ScreenAnalytics } from './src/screens/ScreenAnalytics';
import { ScreenSettings } from './src/screens/ScreenSettings';
import { ScreenAccountDashboard } from './src/screens/ScreenAccountDashboard';
import { ScreenScheduledPayments } from './src/screens/ScreenScheduledPayments';
import { ScreenBudgets } from './src/screens/ScreenBudgets';
import { ScreenNotifications } from './src/screens/ScreenNotifications';
import { ScreenSecurityCenter } from './src/screens/ScreenSecurityCenter';
import { ScreenMandates } from './src/screens/ScreenMandates';
import { ScreenFxExchange } from './src/screens/ScreenFxExchange';
import { ScreenInvoices } from './src/screens/ScreenInvoices';
import { ScreenDisputes } from './src/screens/ScreenDisputes';
import { Shell } from './src/components/Shell';
import { money } from './src/components/UI';
import { MobileSheet } from './src/components/MobileExtras';
import { ToastHost, useToasts } from './src/components/Toast';
import { Icon } from './src/components/Icon';
import { saveSession, loadSession, clearSession, tryRefreshSession, revokeSession } from './src/session';
import { isBiometricAvailable, authenticateBiometric, getBiometricPref, setBiometricPref, hasDismissedBioPrompt, setDismissedBioPrompt } from './src/biometrics';
import { THEME, themedSheet, setAppTheme, persistThemeConfig, loadPersistedThemeConfig } from './src/theme';

// ── Global error boundary — catches render-time crashes in production ──────────
interface EBState { error: Error | null; }
class ErrorBoundary extends Component<{ children: React.ReactNode }, EBState> {
  state: EBState = { error: null };
  static getDerivedStateFromError(e: Error): EBState { return { error: e }; }
  componentDidCatch(e: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught:', e.message, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: '#16161c', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#fb7185', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>FinVault — Crash</Text>
        <Text style={{ color: '#f7f7f9', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>{this.state.error.message}</Text>
        <Text style={{ color: '#8c8c9e', fontSize: 11, textAlign: 'center' }}>{this.state.error.stack?.slice(0, 400)}</Text>
      </View>
    );
  }
}

export interface ThemeConfig {
  mode: 'dark' | 'light';
  accent: string;
  font: string;
  radius: string;
  density: string;
  card: string;
}

export interface AppData {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    initials: string;
    plan: string;
    memberSince: string;
  };
  wallets: Wallet[];
  transactions: Transaction[];
  cards: CardItem[];
  goals: Goal[];
  spendByCat: SpendCat[];
  monthly: MonthlyBar[];
  balanceTrend: number[];
}

interface Wallet {
  id: string;
  iban: string;
  currency: string;
  type: string;
  balance: number;
  interestRate?: number;
  name?: string;
}

interface Transaction {
  id: string;
  reference?: string;
  senderWalletId: string | null;
  receiverWalletId: string | null;
  amount: number;
  currency: string;
  status: string;
  type: string;
  description: string;
  createdAt: string;
}

interface CardItem {
  id: string;
  name: string;
  kind: 'physical' | 'virtual';
  network: string;
  last4: string;
  number: string;
  cvv: string;
  holder: string;
  exp: string;
  frozen: boolean;
  scheme: string;
  walletId: string;
  monthSpend: number;
  limit: number;
}

export interface Beneficiary {
  id: string;
  name: string;
  email?: string | null;
  iban?: string | null;
}

interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  hue: number;
  icon: string;
  due: string;
}

interface SpendCat {
  cat: string;
  label: string;
  amount: number;
  hue: number;
}

interface MonthlyBar {
  m: string;
  in: number;
  out: number;
}

function buildMockData(firstName: string, lastName: string, email: string, wallets: Wallet[], transactions: Transaction[], cards: CardItem[], goals: Goal[], plan = 'Metal'): AppData {
  const initials = `${firstName[0]}${lastName[0]}`.toUpperCase();

  // 1. Calculate active wallets IDs
  const myWalletIds = new Set(wallets.map(w => w.id));

  // 2. Compute dynamic spendByCat (Money Out)
  const catSums: Record<string, { label: string; amount: number; hue: number }> = {
    groceries: { label: 'Groceries', amount: 0, hue: 130 },
    dining:    { label: 'Dining',    amount: 0, hue: 28 },
    transport: { label: 'Transport', amount: 0, hue: 230 },
    shopping:  { label: 'Shopping',  amount: 0, hue: 320 },
    subs:      { label: 'Subs',      amount: 0, hue: 300 },
    bills:     { label: 'Bills',     amount: 0, hue: 200 },
    other:     { label: 'Other',     amount: 0, hue: 265 },
  };

  let totalOutgoing = 0;
  transactions.forEach(t => {
    const amt = typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount)) || 0;
    const isOutgoing = t.senderWalletId && myWalletIds.has(t.senderWalletId);
    
    if (isOutgoing) {
      totalOutgoing += amt;
      const desc = (t.description || '').toLowerCase();
      let cat = 'other';
      if (desc.includes('albert') || desc.includes('groceries') || desc.includes('supermarket') || desc.includes('ah') || desc.includes('heijn') || desc.includes('cart')) {
        cat = 'groceries';
      } else if (desc.includes('uber') || desc.includes('transport') || desc.includes('taxi') || desc.includes('train') || desc.includes('plane') || desc.includes('air') || desc.includes('travel')) {
        cat = 'transport';
      } else if (desc.includes('restaurant') || desc.includes('coffee') || desc.includes('starbucks') || desc.includes('dining') || desc.includes('cafe') || desc.includes('food')) {
        cat = 'dining';
      } else if (desc.includes('spotify') || desc.includes('netflix') || desc.includes('premium') || desc.includes('subs') || desc.includes('youtube')) {
        cat = 'subs';
      } else if (desc.includes('bill') || desc.includes('rent') || desc.includes('utilities') || desc.includes('invoice') || desc.includes('tax') || desc.includes('bolt')) {
        cat = 'bills';
      } else if (desc.includes('shopping') || desc.includes('amazon') || desc.includes('bol') || desc.includes('clothes') || desc.includes('buy') || desc.includes('bag')) {
        cat = 'shopping';
      }
      catSums[cat].amount += amt;
    }
  });

  const spendByCat: SpendCat[] = Object.entries(catSums)
    .map(([cat, val]) => ({ cat, ...val }))
    .filter(c => c.amount > 0);

  if (spendByCat.length === 0) {
    spendByCat.push({ cat: 'other', label: 'Other', amount: 0, hue: 265 });
  }

  // 3. Compute dynamic monthly cashflow (In vs Out)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyMap: Record<string, { in: number; out: number; sortKey: number }> = {};

  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = monthNames[d.getMonth()];
    monthlyMap[label] = { in: 0, out: 0, sortKey: d.getTime() };
  }

  transactions.forEach(t => {
    const amt = typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount)) || 0;
    const date = new Date(t.createdAt);
    const label = monthNames[date.getMonth()];
    const isIncoming = t.receiverWalletId && myWalletIds.has(t.receiverWalletId);
    const isOutgoing = t.senderWalletId && myWalletIds.has(t.senderWalletId);

    if (monthlyMap[label]) {
      if (isIncoming) monthlyMap[label].in += amt;
      if (isOutgoing) monthlyMap[label].out += amt;
    }
  });

  const monthly: MonthlyBar[] = Object.entries(monthlyMap)
    .sort((a, b) => a[1].sortKey - b[1].sortKey)
    .map(([m, val]) => ({ m, in: Math.round(val.in), out: Math.round(val.out) }));

  // 4. Balance Trend — deterministic, reconstructed from monthly cashflow
  const currentBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  const balanceTrend: number[] = [Math.max(0, Math.round(currentBalance))];
  let runBal = currentBalance;
  for (let i = monthly.length - 1; i >= 0; i--) {
    runBal -= monthly[i].in - monthly[i].out;
    balanceTrend.unshift(Math.max(0, Math.round(runBal)));
  }

  // Elevated goals state passed down

  return {
    user: { firstName, lastName, email, initials, plan: `FinVault ${plan}`, memberSince: '2024' },
    wallets, transactions, cards, goals, spendByCat, monthly, balanceTrend,
  };
}

// ---- Plan upgrade bottom sheet ----
const PLANS = [
  { name: 'Standard', price: '€0',     tag: 'Free',       feats: ['1 card', '€200/mo free ATM', 'P2P transfers'] },
  { name: 'Metal',    price: '€9.99',  tag: 'Popular',    feats: ['3 cards', '€2,000/mo free ATM', 'Priority support'] },
  { name: 'Metal+',   price: '€16.99', tag: 'Best value', feats: ['Unlimited cards', 'Unlimited ATM', 'Travel insurance', '3% savings APY'] },
];

function UpgradePlanSheet({ open, onClose, currentPlan, onUpgrade }: { open: boolean; onClose: () => void; currentPlan: string; onUpgrade: (p: string) => void }) {
  const [sel, setSel] = React.useState(currentPlan);

  React.useEffect(() => { if (open) setSel(currentPlan); }, [open, currentPlan]);

  return (
    <MobileSheet open={open} onClose={onClose} title="Choose your plan">
      <View style={{ gap: 10 }}>
        {PLANS.map(p => {
          const active = sel === p.name;
          const isCurrent = p.name === currentPlan;
          return (
            <TouchableOpacity
              key={p.name}
              onPress={() => setSel(p.name)}
              style={[upgStyles.planCard, active ? upgStyles.planCardActive : null]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${p.name} plan, ${p.price} per month${isCurrent ? ', current plan' : ''}`}
            >
              <View style={upgStyles.planHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[upgStyles.planName, active ? upgStyles.planNameActive : null]}>{p.name}</Text>
                  {isCurrent && <View style={upgStyles.chip}><Text style={upgStyles.chipTxt}>Current</Text></View>}
                </View>
                <Text style={[upgStyles.planPrice, active ? upgStyles.planNameActive : null]}>{p.price}<Text style={upgStyles.planPer}>/mo</Text></Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {p.feats.map(f => (
                  <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon name="check" size={11} color={active ? THEME.colors.accent : THEME.colors.text3} />
                    <Text style={upgStyles.feat}>{f}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[upgStyles.confirmBtn, sel === currentPlan ? upgStyles.confirmBtnMuted : null]}
          onPress={() => sel !== currentPlan ? onUpgrade(sel) : onClose()}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={[upgStyles.confirmTxt, sel === currentPlan && upgStyles.confirmTxtMuted]}>
            {sel === currentPlan ? 'Current plan' : `Switch to ${sel}`}
          </Text>
        </TouchableOpacity>
      </View>
    </MobileSheet>
  );
}

const upgStyles = themedSheet(() => StyleSheet.create({
  planCard: {
    backgroundColor: THEME.colors.surface2,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: 14,
    padding: 14,
  },
  planCardActive: {
    borderColor: THEME.colors.accentLine,
    backgroundColor: THEME.colors.accentSoft,
  },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planName: { fontSize: 16, fontWeight: 'bold', color: THEME.colors.text2 },
  planNameActive: { color: THEME.colors.accent },
  planPrice: { fontSize: 16, fontWeight: 'bold', color: THEME.colors.text2 },
  planPer: { fontSize: 11, fontWeight: '400', color: THEME.colors.text3 },
  feat: { fontSize: 12, color: THEME.colors.text3 },
  chip: { backgroundColor: THEME.colors.surface, borderWidth: 1, borderColor: THEME.colors.line, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  chipTxt: { fontSize: 11, color: THEME.colors.text3, fontWeight: '600' },
  confirmBtn: { backgroundColor: THEME.colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  confirmBtnMuted: { backgroundColor: THEME.colors.surface2, borderWidth: 1, borderColor: THEME.colors.line },
  confirmTxt: { fontSize: 15, fontWeight: 'bold', color: THEME.colors.onAccent },
  confirmTxtMuted: { color: THEME.colors.text2 },
}));

export default function App() {
  // --- Auth State ---
  const [token, setToken] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true); // true while loading the stored session
  const [rawUser, setRawUser] = useState<any>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<CardItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [bioPromptOpen, setBioPromptOpen] = useState(false);

  const initializeGoals = useCallback(() => {
    setGoals([
      { id: 'g-japan', name: 'Japan Trip',     target: 4000,  saved: 2680, hue: 12,  icon: 'plane',  due: 'Oct 2026' },
      { id: 'g-emerg', name: 'Emergency Fund', target: 10000, saved: 8200, hue: 158, icon: 'shield', due: 'No date' },
      { id: 'g-mac',   name: 'New MacBook',    target: 2500,  saved: 900,  hue: 265, icon: 'laptop', due: 'Mar 2026' },
    ]);
  }, []);

  const initializeCards = useCallback((first: string, last: string, wId: string) => {
    setCards([
      {
        id: 'card-1', name: 'Everyday Checking', kind: 'physical', network: 'Visa',
        last4: '4182', number: '4182 7771 0377 4182', cvv: '428',
        holder: `${first} ${last}`, exp: '05/31', frozen: false,
        scheme: 'metal', walletId: wId, monthSpend: 712.80, limit: 2000,
      },
      {
        id: 'card-2', name: 'Travel Multi-Currency', kind: 'virtual', network: 'Mastercard',
        last4: '9912', number: '5412 9900 0011 9912', cvv: '831',
        holder: `${first} ${last}`, exp: '11/27', frozen: false,
        scheme: 'cyan', walletId: wId, monthSpend: 214.00, limit: 3000,
      }
    ]);
  }, []);

  // --- Navigation & Overlays ---
  const [route, setRoute] = useState('overview');
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositWalletId, setDepositWalletId] = useState('');
  const [depositAmt, setDepositAmt] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [theme, setTheme] = useState<ThemeConfig>({
    mode: 'dark', accent: 'emerald', font: 'grotesk', radius: 'soft', density: 'regular', card: 'elevated'
  });

  // Apply the palette mutation *before* the state update so the very next
  // render (and the themedSheet rebuilds) already see the new colors.
  const applyAndSetTheme = useCallback((t: ThemeConfig) => {
    setAppTheme({ mode: t.mode, accent: t.accent });
    persistThemeConfig(t as any);
    setTheme(t);
  }, []);

  // Restore the persisted theme on boot.
  useEffect(() => {
    loadPersistedThemeConfig<ThemeConfig>().then(cfg => {
      if (cfg) {
        setAppTheme({ mode: cfg.mode, accent: cfg.accent });
        setTheme(prev => ({ ...prev, ...cfg }));
      }
    });
  }, []);

  // Non-blocking toast feedback (Alert is reserved for destructive confirms).
  const { toasts, fire, dismiss } = useToasts();

  // Android hardware back: step back to overview before letting the OS exit.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (route !== 'overview') {
        setRoute('overview');
        return true;
      }
      return false; // on overview → default behavior (exit)
    });
    return () => sub.remove();
  }, [route]);

  const setupMockSession = useCallback(() => {
    setRawUser({ id: 'mock-u', email: 'tom@finvault.com', profile: { firstName: 'Tom', lastName: 'Bomeke' } });
    setWallets([
      { id: 'mock-wallet-eur', iban: 'BE89 3770 0771 9941', currency: 'EUR', type: 'checking', balance: 4182.55, interestRate: 0, name: 'Everyday' },
      { id: 'mock-wallet-sav', iban: 'BE12 3456 7890 1234', currency: 'EUR', type: 'savings',  balance: 8200.00, interestRate: 0.025, name: 'Savings Vault' },
    ]);
    setTransactions([
      { id: 'tx-1', senderWalletId: null, receiverWalletId: 'mock-wallet-eur', amount: 3200, currency: 'EUR', status: 'confirmed', type: 'deposit', description: 'Monthly salary — Acme Corp', createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
      { id: 'tx-2', senderWalletId: 'mock-wallet-eur', receiverWalletId: null, amount: 89.99, currency: 'EUR', status: 'confirmed', type: 'transfer', description: 'Albert Heijn', createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: 'tx-3', senderWalletId: 'mock-wallet-eur', receiverWalletId: null, amount: 32.50, currency: 'EUR', status: 'confirmed', type: 'transfer', description: 'Uber — Brussels', createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: 'tx-4', senderWalletId: 'mock-wallet-eur', receiverWalletId: null, amount: 9.99,  currency: 'EUR', status: 'confirmed', type: 'transfer', description: 'Spotify Premium', createdAt: new Date(Date.now() - 3600000 * 4).toISOString() },
      { id: 'tx-5', senderWalletId: null, receiverWalletId: 'mock-wallet-eur', amount: 250,   currency: 'EUR', status: 'confirmed', type: 'deposit',  description: 'Invoice payment — Client XYZ', createdAt: new Date(Date.now() - 3600000).toISOString() },
    ]);
    initializeCards('Tom', 'Bomeke', 'mock-wallet-eur');
    initializeGoals();
  }, [initializeCards, initializeGoals]);

  // Configure via apps/mobile/.env → EXPO_PUBLIC_API_URL=http://<your-lan-ip>:8000
  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.6:8000';

  // Restore the persisted session once on launch (keystore-backed). When the
  // user enabled biometric sign-in, the auto-login is gated behind the system
  // biometric prompt (#7); declining lands on the auth screen where the
  // Face ID button offers a retry.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { accessToken } = await loadSession();
        if (!accessToken || cancelled) return;
        if (await getBiometricPref()) {
          if (!(await isBiometricAvailable()) || !(await authenticateBiometric('Unlock FinVault'))) return;
        }
        if (!cancelled) setToken(accessToken);
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchWallets = useCallback(async () => {
    if (!token || token === 'mock-token') return;
    try {
      const res = await fetch(`${API_URL}/api/wallets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setWallets(await res.json());
    } catch {}
  }, [token]);

  const fetchTransactions = useCallback(async () => {
    if (!token || token === 'mock-token') return;
    try {
      const res = await fetch(`${API_URL}/api/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setTransactions(await res.json());
    } catch {}
  }, [token]);

  const fetchCards = useCallback(async () => {
    if (!token || token === 'mock-token') return;
    try {
      const res = await fetch(`${API_URL}/api/cards`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setCards(await res.json());
    } catch {}
  }, [token]);

  const fetchGoals = useCallback(async () => {
    if (!token || token === 'mock-token') return;
    try {
      const res = await fetch(`${API_URL}/api/goals`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setGoals(await res.json());
    } catch {}
  }, [token]);

  const fetchBeneficiaries = useCallback(async () => {
    if (!token || token === 'mock-token') return;
    try {
      const res = await fetch(`${API_URL}/api/beneficiaries`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setBeneficiaries(await res.json());
    } catch {}
  }, [token]);

  const fetchNotificationCount = useCallback(async () => {
    if (!token || token === 'mock-token') return;
    try {
      const res = await fetch(`${API_URL}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const notifs = await res.json();
        setUnreadNotifications(notifs.filter((n: any) => !n.read).length);
      }
    } catch {}
  }, [token]);

  const fetchProfile = useCallback(async () => {
    if (!token || token === 'mock-token') {
      setupMockSession();
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRawUser(data);
        fetchWallets();
        fetchTransactions();
        fetchCards();
        fetchGoals();
        fetchBeneficiaries();
        fetchNotificationCount();
      } else {
        // Access token expired/invalid — try one silent refresh before signing out.
        const refreshed = await tryRefreshSession(API_URL);
        if (refreshed) {
          setToken(refreshed);
        } else {
          await clearSession();
          setToken(null);
        }
      }
    } catch {
      setupMockSession();
    }
  }, [token, fetchWallets, fetchTransactions, fetchCards, fetchGoals]);

  useEffect(() => {
    if (token) {
      fetchProfile();
    }
  }, [token, fetchProfile]);

  const handleLogin = async (email: string, pw: string) => {
    setAuthError('');
    setAuthSuccess('');
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pw })
      });
      if (res.ok) {
        const data = await res.json();
        await saveSession(data.accessToken, data.refreshToken);
        setToken(data.accessToken);
        setAuthSuccess('Welcome back!');
        const [bioAvail, bioDismissed] = await Promise.all([isBiometricAvailable(), hasDismissedBioPrompt()]);
        if (bioAvail && !bioDismissed) setBioPromptOpen(true);
      } else {
        const errorData = await res.json();
        setAuthError(errorData.error || errorData.message || 'Invalid credentials.');
      }
    } catch {
      // Offline fallback
      if (email === 'admin@finvault.com' || email === 'tom@finvault.com') {
        await saveSession('mock-token');
        setToken('mock-token');
        setupMockSession();
        setAuthSuccess('Welcome back (Demo mode)!');
      } else {
        setAuthError('Offline — use admin@finvault.com to log in as demo.');
      }
    }
  };

  // Real biometric login (#7): authenticate, then restore the stored session
  // (refreshing it when the access token went stale). Falls back to the demo
  // session only when biometrics are unavailable on the device, so the demo
  // flow keeps working in simulators.
  const handleFaceIdLogin = async () => {
    setAuthError('');
    setAuthSuccess('');
    if (!(await isBiometricAvailable())) {
      setRawUser(null);
      saveSession('mock-token');
      setToken('mock-token');
      setupMockSession();
      setAuthSuccess('Biometrics unavailable — demo session started.');
      return;
    }
    if (!(await authenticateBiometric('Sign in to FinVault'))) {
      setAuthError('Biometric authentication was cancelled.');
      return;
    }
    const { accessToken } = await loadSession();
    if (accessToken) {
      setToken(accessToken);
      setAuthSuccess('Welcome back!');
      return;
    }
    const refreshed = await tryRefreshSession(API_URL);
    if (refreshed) {
      setToken(refreshed);
      setAuthSuccess('Welcome back!');
    } else {
      setAuthError('No saved session on this device — sign in with your password first.');
    }
  };

  const handleRegister = async (firstName: string, lastName: string, email: string, pw: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password: pw })
      });
      if (res.ok) {
        setAuthSuccess('Account created successfully! Please log in.');
      } else {
        const err = await res.json();
        setAuthError(err.message || 'Registration failed.');
      }
    } catch {
      setAuthSuccess('Account created successfully (Demo mode)!');
    }
  };

  const handleLogout = async () => {
    if (token && token !== 'mock-token') {
      await revokeSession(API_URL); // best-effort server-side revocation
    }
    await clearSession();
    setToken(null);
    setRawUser(null);
    setCards([]);
    setGoals([]);
  };

  const handleUpgradePlan = async (newPlan: string) => {
    if (!token || token === 'mock-token') {
      setRawUser((prev: any) => prev ? { ...prev, plan: newPlan } : null);
      fire('Plan updated', `Welcome to FinVault ${newPlan}!`, 'success');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/users/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: newPlan })
      });
      if (res.ok) {
        const updated = await res.json();
        setRawUser(updated);
        fire('Plan updated', `Welcome to FinVault ${newPlan}!`, 'success');
      }
    } catch {
      fire('Plan change failed', 'Could not update your plan. Try again later.', 'warn');
    }
  };

  // Returns true on success so the screen only resets the form for real
  // transfers (#11); failures surface the backend reason as a warn toast.
  const handleTransfer = async (target: { email?: string; iban?: string }, amount: number, desc: string, walletId: string): Promise<boolean> => {
    const wallet = wallets.find(w => w.id === walletId) || wallets[0];
    if (!wallet) return false;
    const label = target.email || target.iban || '';

    const applyLocalDebit = () => {
      setWallets(prev => prev.map(w => w.id === walletId ? { ...w, balance: w.balance - amount } : w));
    };

    if (token && token !== 'mock-token') {
      try {
        const res = await fetch(`${API_URL}/api/transactions/transfer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ receiverEmail: target.email, receiverIban: target.iban, amount, description: desc, senderWalletId: walletId })
        });
        if (res.ok) {
          // Immediate balance feedback, then reconcile with the server (#12).
          applyLocalDebit();
          fire('Transfer completed', `${money(amount)} sent to ${label}.`, 'success');
          fetchBeneficiaries(); // backend auto-upserts the payee (#25)
          await Promise.all([fetchWallets(), fetchTransactions()]);
          return true;
        } else {
          const err = await res.json();
          fire('Transfer failed', err.error || err.message || 'Could not complete transfer.', 'warn');
          return false;
        }
      } catch {
        // Network unreachable — fall through to the offline demo path.
      }
    }

    applyLocalDebit();
    setTransactions(prev => [{
      id: Math.random().toString(), senderWalletId: walletId, receiverWalletId: null,
      amount, currency: wallet.currency, status: 'confirmed', type: 'transfer',
      description: desc, createdAt: new Date().toISOString()
    }, ...prev]);
    fire('Transfer completed (Demo)', `${money(amount)} sent to ${label}.`, 'success');
    return true;
  };

  const handleRequest = async (email: string, amount: number, desc: string) => {
    try {
      const res = await fetch(`${API_URL}/api/invoices/payment-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipientEmail: email, amount, description: desc || 'Payment request', currency: 'EUR' }),
      });
      if (res.ok) {
        fire('Request sent', `Payment request of ${money(amount)} sent to ${email}.`, 'success');
      } else {
        const err = await res.json();
        fire('Error', err.error || 'Failed to send request.', 'error');
      }
    } catch {
      fire('Request sent', `Payment request of ${money(amount)} sent to ${email}.`, 'success');
    }
  };

  const handleDeposit = () => {
    const val = parseFloat(depositAmt);
    if (!val || val <= 0) return;

    setDepositLoading(true);
    const selectedId = depositWalletId || wallets[0]?.id;
    const wallet = wallets.find(w => w.id === selectedId) || wallets[0];

    if (token && token !== 'mock-token') {
      fetch(`${API_URL}/api/wallets/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount: val, walletId: wallet.id })
      }).then(res => {
        if (res.ok) {
          const wName = wallet.name || (wallet.type === 'savings' ? 'Savings Vault' : wallet.type === 'travel' ? 'Travel Multi-Currency' : 'Everyday Checking');
          fire('Deposit added', `${money(val, wallet.currency)} deposited into your ${wName} account.`, 'success');
          fetchWallets();
          fetchTransactions();
          setDepositLoading(false);
          setDepositAmt('');
          setDepositOpen(false);
        } else {
          throw new Error('API error');
        }
      }).catch(() => {
        // Fallback
        setWallets(prev => prev.map(w => w.id === wallet.id ? { ...w, balance: w.balance + val } : w));
        setTransactions(prev => [{
          id: Math.random().toString(), senderWalletId: null, receiverWalletId: wallet.id,
          amount: val, currency: wallet.currency || 'EUR', status: 'confirmed', type: 'deposit',
          description: 'Cash deposit', createdAt: new Date().toISOString()
        } as any, ...prev]);
        setDepositLoading(false);
        setDepositAmt('');
        setDepositOpen(false);
        const wName = wallet.name || (wallet.type === 'savings' ? 'Savings Vault' : wallet.type === 'travel' ? 'Travel Multi-Currency' : 'Everyday Checking');
        fire('Deposit added (Demo)', `${money(val, wallet.currency)} deposited into your ${wName} account.`, 'success');
      });
      return;
    }

    setTimeout(() => {
      setWallets(prev => prev.map(w => w.id === wallet.id ? { ...w, balance: w.balance + val } : w));
      setTransactions(prev => [{
        id: Math.random().toString(), senderWalletId: null, receiverWalletId: wallet.id,
        amount: val, currency: wallet.currency || 'EUR', status: 'confirmed', type: 'deposit',
        description: 'Cash deposit', createdAt: new Date().toISOString()
      } as any, ...prev]);
      setDepositLoading(false);
      setDepositAmt('');
      setDepositOpen(false);
      const wName = wallet.name || (wallet.type === 'savings' ? 'Savings Vault' : wallet.type === 'travel' ? 'Travel Multi-Currency' : 'Everyday Checking');
      fire('Deposit added (Demo)', `${money(val, wallet.currency)} deposited into your ${wName} account.`, 'success');
    }, 800);
  };

  const handleOwnTransfer = async (fromWalletId: string, toWalletId: string, amount: number, description: string): Promise<void> => {
    const fromWallet = wallets.find(w => w.id === fromWalletId);
    const toWallet   = wallets.find(w => w.id === toWalletId);
    if (!fromWallet || !toWallet) { Alert.alert('Error', 'Account not found.'); return; }

    if (token && token !== 'mock-token') {
      try {
        const res = await fetch(`${API_URL}/api/transactions/own-transfer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fromWalletId, toWalletId, amount, description })
        });
        if (res.ok) {
          const result = await res.json();
          setWallets(prev => prev.map(w => {
            if (w.id === fromWalletId) return { ...w, balance: result.fromBalance };
            if (w.id === toWalletId)   return { ...w, balance: result.toBalance };
            return w;
          }));
          setTransactions(prev => [result.transaction, ...prev]);
          fire('Transfer complete', `${money(amount)} moved to ${toWallet.name || toWallet.type}.`, 'success');
          return;
        } else {
          const err = await res.json();
          Alert.alert('Transfer failed', err.error || err.message || 'Could not complete transfer.');
          return;
        }
      } catch { /* fall through to local simulation */ }
    }

    // Local demo fallback
    setWallets(prev => prev.map(w => {
      if (w.id === fromWalletId) return { ...w, balance: w.balance - amount };
      if (w.id === toWalletId)   return { ...w, balance: w.balance + amount };
      return w;
    }));
    setTransactions(prev => [{
      id: `own-${Date.now()}`,
      senderWalletId: fromWalletId,
      receiverWalletId: toWalletId,
      amount, currency: fromWallet.currency,
      status: 'confirmed', type: 'transfer',
      description: description || `Transfer: ${fromWallet.name} → ${toWallet.name}`,
      createdAt: new Date().toISOString()
    } as Transaction, ...prev]);
    fire('Transfer complete (Demo)', `${money(amount)} moved to ${toWallet.name || toWallet.type}.`, 'success');
  };

  const firstName = rawUser?.profile?.firstName || rawUser?.firstName || 'Tom';
  const lastName  = rawUser?.profile?.lastName  || rawUser?.lastName  || 'Bomeke';
  const email     = rawUser?.email || 'tom@finvault.com';
  const appData   = buildMockData(firstName, lastName, email, wallets, transactions, cards, goals, rawUser?.plan || 'Metal');

  const renderScreen = () => {
    // Account dashboard routing: 'account:walletId'
    if (route.startsWith('account:')) {
      const walletId = route.replace('account:', '');
      return (
        <ScreenAccountDashboard
          walletId={walletId}
          data={appData}
          navigate={setRoute}
          onOwnTransfer={handleOwnTransfer}
        />
      );
    }
    switch (route) {
      case 'overview':
        return <ScreenOverview navigate={setRoute} data={appData} onTopup={() => setDepositOpen(true)} />;
      case 'transactions':
        return <ScreenTransactions data={appData} onExport={() => fire('Export complete', 'Your transactions CSV was shared.', 'success')} />;
      case 'transfer':
        return <ScreenTransfer data={appData} beneficiaries={beneficiaries} onTransfer={handleTransfer} onRequest={handleRequest} />;
      case 'cards':
        return <ScreenCards data={appData} fire={fire} cards={cards} setCards={setCards} token={token} apiUrl={API_URL} navigate={setRoute} />;
      case 'analytics':
        return <ScreenAnalytics data={appData} />;
      case 'savings':
        return <ScreenSavings data={appData} fire={fire} goals={goals} setGoals={setGoals} wallets={wallets} setWallets={setWallets} setTransactions={setTransactions} token={token} apiUrl={API_URL} />;
      case 'settings':
        return <ScreenSettings data={appData} theme={theme} setTheme={applyAndSetTheme} onLogout={handleLogout} fire={fire} openUpgrade={() => setUpgradeOpen(true)} token={token} apiUrl={API_URL} navigate={setRoute} />;
      case 'scheduled-payments':
        return <ScreenScheduledPayments token={token} apiUrl={API_URL} wallets={wallets} fire={fire} />;
      case 'budgets':
        return <ScreenBudgets token={token} apiUrl={API_URL} fire={fire} />;
      case 'notifications':
        return <ScreenNotifications token={token} apiUrl={API_URL} fire={fire} onBack={() => setRoute('overview')} />;
      case 'security':
        return <ScreenSecurityCenter token={token} apiUrl={API_URL} fire={fire} onBack={() => setRoute('settings')} onPasswordChanged={(at, rt) => { setToken(at); saveSession(at, rt); }} />;
      case 'mandates':
        return <ScreenMandates token={token} apiUrl={API_URL} fire={fire} onBack={() => setRoute('settings')} />;
      case 'fx-exchange':
        return <ScreenFxExchange token={token} apiUrl={API_URL} wallets={wallets} fire={fire} onBack={() => setRoute('overview')} onRefresh={() => { fetchWallets(); fetchTransactions(); }} />;
      case 'invoices':
        return <ScreenInvoices token={token} apiUrl={API_URL} fire={fire} onBack={() => setRoute('settings')} />;
      case 'disputes':
        return <ScreenDisputes token={token} apiUrl={API_URL} transactions={transactions} fire={fire} onBack={() => setRoute('settings')} />;
      default:
        return <ScreenOverview navigate={setRoute} data={appData} onTopup={() => setDepositOpen(true)} />;
    }
  };

  return (
    // Key forces a clean remount on theme switch so every component re-reads
    // the mutated THEME object (inline styles + themedSheet proxies).
    <SafeAreaView key={`${theme.mode}-${theme.accent}`} style={styles.container}>
      <StatusBar barStyle={THEME.statusBarStyle} backgroundColor={THEME.colors.bg} />

      {/* Session restore splash, Auth screen, or Main application shell */}
      {restoring ? (
        <View style={styles.splash}>
          <View style={styles.splashLogo}>
            <Icon name="shield" size={26} color={THEME.colors.onAccent} />
          </View>
          <Text style={styles.splashText}>FinVault</Text>
        </View>
      ) : !token ? (
        <ScreenAuth
          onLogin={handleLogin}
          onRegister={handleRegister}
          authError={authError}
          authSuccess={authSuccess}
          onFaceIdLogin={handleFaceIdLogin}
        />
      ) : (
        <Shell route={route} setRoute={setRoute} user={appData.user} unreadNotifications={unreadNotifications}>
          {renderScreen()}
        </Shell>
      )}

      {/* Plan upgrade sheet */}
      <UpgradePlanSheet
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        currentPlan={rawUser?.plan || 'Metal'}
        onUpgrade={(p) => { setUpgradeOpen(false); handleUpgradePlan(p); }}
      />

      {/* Biometric opt-in prompt (#62) — shown once after first login */}
      <MobileSheet open={bioPromptOpen} onClose={async () => { await setDismissedBioPrompt(true); setBioPromptOpen(false); }} title="Enable Face ID?">
        <View style={{ gap: 16, paddingVertical: 8 }}>
          <Text style={{ color: THEME.colors.text2, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
            Sign in faster next time with biometrics. You can change this later in Settings.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: THEME.colors.accent, paddingVertical: 14, borderRadius: THEME.radius.regular, alignItems: 'center' }}
            onPress={async () => {
              await setBiometricPref(true);
              await setDismissedBioPrompt(true);
              setBioPromptOpen(false);
              fire('Biometrics enabled', 'Face ID will be used on next sign-in.', 'success');
            }}
          >
            <Text style={{ color: THEME.colors.onAccent, fontWeight: '700', fontSize: 15 }}>Enable</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ paddingVertical: 12, alignItems: 'center' }}
            onPress={async () => { await setDismissedBioPrompt(true); setBioPromptOpen(false); }}
          >
            <Text style={{ color: THEME.colors.text3, fontSize: 14 }}>Not now</Text>
          </TouchableOpacity>
        </View>
      </MobileSheet>

      {/* Dynamic topup modal sheet */}
      <MobileSheet open={depositOpen} onClose={() => setDepositOpen(false)} title="Top up account">
        <View style={styles.sheetForm}>
          <Text style={styles.sheetDesc}>Top up your account balance instantly.</Text>
          
          <Text style={styles.label}>Destination Account</Text>
          <View style={{ gap: 6, marginBottom: 12 }}>
            {wallets.map(w => {
              const selected = (depositWalletId || wallets[0]?.id) === w.id;
              return (
                <TouchableOpacity 
                  key={w.id} 
                  onPress={() => setDepositWalletId(w.id)}
                  style={{
                    padding: 10,
                    borderRadius: THEME.radius.sm,
                    backgroundColor: THEME.colors.surface2,
                    borderWidth: selected ? 1.5 : 1,
                    borderColor: selected ? THEME.colors.accent : THEME.colors.line,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: THEME.colors.text, fontWeight: '700', fontSize: 13 }}>
                    {w.name || (w.type === 'savings' ? 'Savings Vault' : w.type === 'travel' ? 'Travel Multi-Currency' : 'Everyday Checking')}
                  </Text>
                  <Text style={{ color: THEME.colors.text3, fontSize: 11 }}>
                    {w.iban ? `${w.iban.substring(w.iban.length - 4)}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Amount to deposit</Text>
          <TextInput
            style={styles.amountInput}
            value={depositAmt}
            onChangeText={v => setDepositAmt(v.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            placeholderTextColor={THEME.colors.text3}
            keyboardType="decimal-pad"
          />

          <View style={styles.quickChips}>
            {[50, 100, 250, 500].map(v => (
              <TouchableOpacity key={v} style={styles.chip} onPress={() => setDepositAmt(String(v))}>
                <Text style={styles.chipText}>+€{v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, (depositLoading || !depositAmt) && { opacity: 0.5 }]}
            onPress={handleDeposit}
            disabled={depositLoading || !depositAmt}
            accessibilityRole="button"
            accessibilityLabel="Deposit"
            accessibilityState={{ disabled: depositLoading || !depositAmt, busy: depositLoading }}
          >
            <Text style={styles.submitText}>{depositLoading ? 'Processing…' : 'Deposit'}</Text>
          </TouchableOpacity>
        </View>
      </MobileSheet>

      {/* Toast notifications overlay */}
      <ToastHost toasts={toasts} onDismiss={dismiss} />
    </SafeAreaView>
  );
}

const styles = themedSheet(() => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0,
  },
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  splashLogo: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: THEME.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: THEME.colors.text,
    letterSpacing: -0.4,
  },
  sheetForm: {
    gap: 16,
  },
  sheetDesc: {
    fontSize: 13,
    color: THEME.colors.text2,
    lineHeight: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.text2,
  },
  amountInput: {
    backgroundColor: THEME.colors.surface2,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.regular,
    paddingVertical: 14,
    color: THEME.colors.text,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  quickChips: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    backgroundColor: THEME.colors.surface2,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.regular,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: 'bold',
    color: THEME.colors.text,
  },
  submitBtn: {
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.radius.regular,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: {
    color: THEME.colors.onAccent,
    fontSize: 15,
    fontWeight: 'bold',
  },
}));
