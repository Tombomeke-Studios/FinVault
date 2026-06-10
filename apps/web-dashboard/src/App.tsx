import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shell } from './components/Shell';
import { ScreenAuth } from './screens/ScreenAuth';
import { ScreenOverview } from './screens/ScreenOverview';
import { ScreenTransactions } from './screens/ScreenTransactions';
import { ScreenTransfer } from './screens/ScreenTransfer';
import { ScreenCards } from './screens/ScreenCards';
import { ScreenAnalytics } from './screens/ScreenAnalytics';
import { ScreenSavings } from './screens/ScreenSavings';
import { ScreenSettings } from './screens/ScreenSettings';
import { ScreenAccountDashboard } from './screens/ScreenAccountDashboard';
import { ScreenLanding } from './screens/ScreenLanding';
import { Sheet, money } from './components/UI';
import { IOSDevice } from './components/IOSFrame';
import { Icon } from './components/Icon';

// ============================================================
// Types
// ============================================================
export interface ThemeConfig {
  mode: 'dark' | 'light';
  accent: string;
  font: string;
  radius: string;
  density: string;
  card: string;
}

export interface ToastData {
  title: string;
  body?: string;
  type: 'success' | 'warn' | 'info';
  id?: number;
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
  reservedBalance?: number;
  status?: string;
  walletId?: string;
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

// ============================================================
// URL ↔ Route mapping
// ============================================================
const PATH_TO_ROUTE: Record<string, string> = {
  '/':            'overview',
  '/dashboard':   'overview',
  '/activity':    'transactions',
  '/transfer':    'transfer',
  '/cards':       'cards',
  '/analytics':   'analytics',
  '/goals':       'savings',
  '/settings':    'settings',
};

const ROUTE_TO_PATH: Record<string, string> = {
  overview:     '/dashboard',
  transactions: '/activity',
  transfer:     '/transfer',
  cards:        '/cards',
  analytics:    '/analytics',
  savings:      '/goals',
  settings:     '/settings',
};

// ============================================================
// Font and accent maps
// ============================================================
const FONTS: Record<string, { display: string; body: string; num: string; label: string }> = {
  grotesk:   { display: "'Space Grotesk'", body: "'Hanken Grotesque'", num: "'Space Grotesk'", label: 'Grotesk' },
  bricolage: { display: "'Bricolage Grotesque'", body: "'Hanken Grotesque'", num: "'Space Grotesk'", label: 'Display' },
  editorial: { display: "'Instrument Serif'", body: "'Hanken Grotesque'", num: "'Space Grotesk'", label: 'Editorial' },
  mono:      { display: "'JetBrains Mono'", body: "'JetBrains Mono'", num: "'JetBrains Mono'", label: 'Mono' },
};

const ACCENTS: Record<string, { h: number; c: number; l: number; on: string; sw: string }> = {
  emerald: { h: 158, c: 0.13, l: 0.62, on: 'oklch(0.99 0 0)', sw: 'oklch(0.62 0.13 158)' },
  indigo:  { h: 265, c: 0.15, l: 0.56, on: 'oklch(0.99 0 0)', sw: 'oklch(0.56 0.15 265)' },
  violet:  { h: 305, c: 0.16, l: 0.58, on: 'oklch(0.99 0 0)', sw: 'oklch(0.58 0.16 305)' },
  azure:   { h: 232, c: 0.14, l: 0.60, on: 'oklch(0.99 0 0)', sw: 'oklch(0.60 0.14 232)' },
  amber:   { h: 75,  c: 0.13, l: 0.74, on: 'oklch(0.24 0.03 80)', sw: 'oklch(0.74 0.13 75)' },
  rose:    { h: 12,  c: 0.16, l: 0.62, on: 'oklch(0.99 0 0)', sw: 'oklch(0.62 0.16 12)' },
};

const PRESETS: Record<string, ThemeConfig> = {
  Vault:    { mode: 'dark',  accent: 'emerald', font: 'grotesk',   radius: 'soft',  density: 'regular', card: 'elevated' },
  Daylight: { mode: 'light', accent: 'indigo',  font: 'grotesk',   radius: 'soft',  density: 'regular', card: 'outline' },
  Aurora:   { mode: 'dark',  accent: 'violet',  font: 'bricolage', radius: 'round', density: 'comfy',   card: 'glass' },
  Carbon:   { mode: 'dark',  accent: 'azure',   font: 'mono',      radius: 'sharp', density: 'compact', card: 'outline' },
  Sand:     { mode: 'light', accent: 'amber',   font: 'editorial', radius: 'round', density: 'comfy',   card: 'elevated' },
};

function applyTheme(t: ThemeConfig) {
  const el = document.documentElement;
  el.setAttribute('data-mode',    t.mode);
  el.setAttribute('data-radius',  t.radius);
  el.setAttribute('data-density', t.density);
  el.setAttribute('data-card',    t.card);
  const a = ACCENTS[t.accent] || ACCENTS.emerald;
  el.style.setProperty('--accent-h', String(a.h));
  el.style.setProperty('--accent-c', String(a.c));
  el.style.setProperty('--accent-l', String(a.l));
  el.style.setProperty('--on-accent', a.on);

  const f = FONTS[t.font] || FONTS.grotesk;
  const dispFb = t.font === 'editorial' ? ', Georgia, serif' : t.font === 'mono' ? ', ui-monospace, monospace' : ', system-ui, sans-serif';
  const bodyFb = t.font === 'mono' ? ', ui-monospace, monospace' : ', system-ui, sans-serif';
  el.style.setProperty('--font-display', f.display + dispFb);
  el.style.setProperty('--font-body',    f.body + bodyFb);
  el.style.setProperty('--font-num',     f.num + (t.font === 'mono' ? ', ui-monospace, monospace' : ', system-ui, sans-serif'));
}

// ============================================================
// Mock data generators
// ============================================================
function buildMockData(firstName: string, lastName: string, email: string, wallets: Wallet[], transactions: Transaction[], cards: CardItem[], goals: Goal[], plan: string): AppData {
  const initials = `${firstName[0]}${lastName[0]}`.toUpperCase();

  const myWalletIds = new Set(wallets.map(w => w.id));

  const catSums: Record<string, { label: string; amount: number; hue: number }> = {
    groceries: { label: 'Groceries', amount: 0, hue: 130 },
    dining:    { label: 'Dining',    amount: 0, hue: 28 },
    transport: { label: 'Transport', amount: 0, hue: 230 },
    shopping:  { label: 'Shopping',  amount: 0, hue: 320 },
    subs:      { label: 'Subs',      amount: 0, hue: 300 },
    bills:     { label: 'Bills',     amount: 0, hue: 200 },
    other:     { label: 'Other',     amount: 0, hue: 265 },
  };

  transactions.forEach(t => {
    const amt = typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount)) || 0;
    const isOutgoing = t.senderWalletId && myWalletIds.has(t.senderWalletId);
    if (isOutgoing) {
      const desc = (t.description || '').toLowerCase();
      let cat = 'other';
      if (desc.includes('albert') || desc.includes('groceries') || desc.includes('supermarket') || desc.includes('ah') || desc.includes('heijn') || desc.includes('cart')) cat = 'groceries';
      else if (desc.includes('uber') || desc.includes('transport') || desc.includes('taxi') || desc.includes('train') || desc.includes('plane') || desc.includes('air') || desc.includes('travel')) cat = 'transport';
      else if (desc.includes('restaurant') || desc.includes('coffee') || desc.includes('starbucks') || desc.includes('dining') || desc.includes('cafe') || desc.includes('food')) cat = 'dining';
      else if (desc.includes('spotify') || desc.includes('netflix') || desc.includes('premium') || desc.includes('subs') || desc.includes('youtube')) cat = 'subs';
      else if (desc.includes('bill') || desc.includes('rent') || desc.includes('utilities') || desc.includes('invoice') || desc.includes('tax') || desc.includes('bolt')) cat = 'bills';
      else if (desc.includes('shopping') || desc.includes('amazon') || desc.includes('bol') || desc.includes('clothes') || desc.includes('buy') || desc.includes('bag')) cat = 'shopping';
      catSums[cat].amount += amt;
    }
  });

  const spendByCat: SpendCat[] = Object.entries(catSums)
    .map(([cat, val]) => ({ cat, ...val }))
    .filter(c => c.amount > 0);
  if (spendByCat.length === 0) spendByCat.push({ cat: 'other', label: 'Other', amount: 0, hue: 265 });

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

  const currentBalance = wallets.reduce((sum, w) => sum + w.balance, 0);
  const balanceTrend: number[] = [Math.max(0, Math.round(currentBalance))];
  let runBal = currentBalance;
  for (let i = monthly.length - 1; i >= 0; i--) {
    runBal -= monthly[i].in - monthly[i].out;
    balanceTrend.unshift(Math.max(0, Math.round(runBal)));
  }

  return {
    user: { firstName, lastName, email, initials, plan: plan.startsWith('FinVault') ? plan : `FinVault ${plan}`, memberSince: '2024' },
    wallets, transactions, cards, goals, spendByCat, monthly, balanceTrend,
  };
}

// ============================================================
// App
// ============================================================
export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const isMobileMode = (window as any).FV_MODE === 'mobile' || new URLSearchParams(location.search).get('mode') === 'mobile';

  // Derive current route from URL
  const urlRoute = PATH_TO_ROUTE[location.pathname] ?? 'overview';
  // accountRoute holds 'account:walletId' sub-routes that don't have URL paths
  const [accountRoute, setAccountRoute] = useState<string | null>(null);
  const route = accountRoute ?? urlRoute;

  const setRoute = useCallback((r: string) => {
    if (r.startsWith('account:')) {
      // Sub-route: store in state, don't change URL
      setAccountRoute(r);
      return;
    }
    // Clear any sub-route when navigating away
    setAccountRoute(null);
    const parts = r.split('?');
    const routeKey = parts[0];
    const query = parts[1] ? '?' + parts[1] : '';
    navigate((ROUTE_TO_PATH[routeKey] || '/dashboard') + query);
  }, [navigate]);

  // Clear account sub-route when URL changes (e.g. browser back button or nav click)
  useEffect(() => { setAccountRoute(null); }, [location.pathname]);

  // --- Auth state ---
  const [token, setToken] = useState<string | null>(localStorage.getItem('finvault_token'));
  const [authLoading, setAuthLoading] = useState(() => !!localStorage.getItem('finvault_token'));
  const [rawUser, setRawUser] = useState<any>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<CardItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Goals persistence across reloads
  const goalsInitRef = useRef(false);
  useEffect(() => {
    if (!goalsInitRef.current) {
      goalsInitRef.current = true;
      return;
    }
    if (goals.length > 0) localStorage.setItem('fv_mock_goals', JSON.stringify(goals));
  }, [goals]);

  const initializeGoals = useCallback(() => {
    const saved = localStorage.getItem('fv_mock_goals');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Goal[];
        if (Array.isArray(parsed) && parsed.length > 0) { setGoals(parsed); return; }
      } catch { /* ignore */ }
    }
    setGoals([
      { id: 'g-japan', name: 'Japan Trip',     target: 4000,  saved: 2680, hue: 12,  icon: 'plane',  due: 'Oct 2026' },
      { id: 'g-emerg', name: 'Emergency Fund', target: 10000, saved: 8200, hue: 158, icon: 'shield', due: 'No date' },
      { id: 'g-mac',   name: 'New MacBook',    target: 2500,  saved: 900,  hue: 265, icon: 'laptop', due: 'Mar 2026' },
      { id: 'g-car',   name: 'Car Deposit',    target: 6000,  saved: 1500, hue: 230, icon: 'car',    due: 'Jul 2027' },
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

  // --- UI state ---
  const [compact, setCompact] = useState(window.innerWidth < 768 || isMobileMode);
  const [vw, setVw] = useState(window.innerWidth);
  const [vh, setVh] = useState(window.innerHeight);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositWalletId, setDepositWalletId] = useState('');
  const [depositAmt, setDepositAmt] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);

  // --- Theme state ---
  const [theme, setThemeState] = useState<ThemeConfig>({
    mode: 'dark', accent: 'emerald', font: 'grotesk',
    radius: 'soft', density: 'regular', card: 'elevated',
  });

  // --- Toast ---
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Notifications ---
  const [notifications, setNotifications] = useState<Array<{title:string;body:string;type:string;time:string}>>([]);

  // --- WebSocket ---
  const wsRef = useRef<WebSocket | null>(null);

  // Responsive listener
  useEffect(() => {
    const onResize = () => {
      setCompact(window.innerWidth < 768 || isMobileMode);
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isMobileMode]);

  // Apply theme on change
  useEffect(() => { applyTheme(theme); }, [theme]);

  const setTheme = (t: ThemeConfig | ((k: keyof ThemeConfig, v: string) => ThemeConfig)) => {
    if (typeof t === 'function') return;
    setThemeState(t);
  };

  // fire = show toast + add notification
  const fire = useCallback((title: string, body: string, type: string = 'info') => {
    const td = { title, body, type: type as ToastData['type'], id: Date.now() };
    setToast(td);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3500);
    setNotifications(prev => [{
      title, body,
      type: type as any,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }, ...prev.slice(0, 19)]);
  }, []);

  // --- Fetch helpers ---
  const fetchWallets = useCallback(async () => {
    try {
      const res = await fetch('/api/wallets', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setWallets(await res.json());
    } catch { /* stay with current wallets */ }
  }, [token]);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/transactions', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setTransactions(await res.json());
    } catch { /* stay with current */ }
  }, [token]);

  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch('/api/cards', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setCards(await res.json());
    } catch { /* stay with current */ }
  }, [token]);

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch('/api/goals', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setGoals(data);
        localStorage.setItem('fv_mock_goals', JSON.stringify(data));
      }
    } catch { /* stay with current */ }
  }, [token]);

  // Offline demo session
  const setupMockSession = useCallback(() => {
    const fakeUser = { id: 'mock-u', email: 'tom@finvault.com', accountType: 'personal', profile: { firstName: 'Tom', lastName: 'Bomeke' } };
    setRawUser(fakeUser);
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
    setAuthLoading(false);
    fire('Demo mode active', 'Backend offline — showing demo data.', 'info');
  }, [fire, initializeCards, initializeGoals]);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/users/profile', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setRawUser(data);
        fetchWallets();
        fetchTransactions();
        fetchCards();
        fetchGoals();
        setAuthLoading(false);
      } else {
        localStorage.removeItem('finvault_token');
        setToken(null);
        setAuthLoading(false);
      }
    } catch {
      setupMockSession();
    }
  }, [token, fetchWallets, fetchTransactions, fetchCards, fetchGoals, setupMockSession]);

  // Connect WebSocket
  const connectWs = useCallback(() => {
    if (!token || !rawUser) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '3000' ? 'localhost:8000' : window.location.host;
    try {
      const ws = new WebSocket(`${protocol}//${host}?token=${token}`);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const { event: { type, payload } } = JSON.parse(e.data);
          if (type === 'balance.updated') {
            setWallets(prev => prev.map(w => w.id === payload.walletId ? { ...w, balance: payload.balance } : w));
            fire('Balance updated', `New balance: ${money(payload.balance)}`, 'success');
          } else if (type === 'payment.confirmed') {
            fire('Payment confirmed', `Ref: ${payload.reference}`, 'success');
            fetchTransactions();
            fetchWallets();
          }
        } catch { /* ignore */ }
      };
    } catch { /* ignore ws failure */ }
  }, [token, rawUser, fire, fetchTransactions, fetchWallets]);

  useEffect(() => {
    if (token) fetchProfile();
    else { setRawUser(null); setWallets([]); setTransactions([]); setCards([]); setGoals([]); setAuthLoading(false); }
  }, [token]);

  useEffect(() => { if (rawUser && token) connectWs(); }, [rawUser, token]);

  // Auth redirects
  useEffect(() => {
    if (authLoading) return;
    const PUBLIC_PATHS = ['/', '/login'];
    if (!token || !rawUser) {
      // Redirect protected routes to login, preserving the intended destination
      if (!PUBLIC_PATHS.includes(location.pathname)) {
        navigate('/login', { replace: true, state: { from: location.pathname } });
      }
    } else if (rawUser) {
      // After login, send user to their intended destination or the dashboard
      if (location.pathname === '/login' || location.pathname === '/') {
        const from = (location.state as any)?.from;
        const dest = from && !PUBLIC_PATHS.includes(from) ? from : '/dashboard';
        navigate(dest, { replace: true });
      }
    }
  }, [token, rawUser, authLoading, location.pathname]);

  // --- Auth handlers ---
  const handleLogin = async (email: string, password: string) => {
    setAuthError(''); setAuthSuccess('');
    const DEMO_EMAILS = ['admin@finvault.com', 'tom@finvault.com'];
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('finvault_token', data.accessToken);
        setToken(data.accessToken);
        setAuthSuccess('Welcome back!');
      } else {
        // API responded with an error — do not fall back to demo mode
        setAuthError(data.error || 'Invalid email or password.');
      }
    } catch {
      // Backend unreachable — only grant demo access to known demo accounts
      if (DEMO_EMAILS.includes(email.trim().toLowerCase())) {
        localStorage.setItem('finvault_token', 'mock-token-abc');
        setToken('mock-token-abc');
      } else {
        setAuthError('Server is unavailable. To explore the demo, use admin@finvault.com');
      }
    }
  };

  const handleRegister = async (firstName: string, lastName: string, email: string, password: string) => {
    setAuthError(''); setAuthSuccess('');
    try {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, firstName, lastName, dateOfBirth: '1995-01-01', address: 'Meir 1', country: 'Belgium', accountType: 'personal' }) });
      const data = await res.json();
      if (res.ok) {
        setAuthSuccess('Account created! Please sign in.');
      } else {
        setAuthError(data.error || 'Registration failed.');
      }
    } catch {
      setAuthError('Cannot connect to registration service.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('finvault_token');
    setToken(null); setRawUser(null); setWallets([]); setTransactions([]); setCards([]); setGoals([]);
    if (wsRef.current) wsRef.current.close();
    navigate('/login', { replace: true });
  };

  const handleTransfer = async (email: string, amount: number, desc: string, walletId: string) => {
    const wallet = wallets.find(w => w.id === walletId) || wallets[0];
    if (!wallet) throw new Error('No wallet found.');
    if (amount <= 0) throw new Error('Amount must be greater than zero.');
    if (amount > wallet.balance) {
      fire('Insufficient funds', `Your ${wallet.name || 'account'} balance is ${money(wallet.balance, wallet.currency)}.`, 'warn');
      return;
    }
    try {
      const res = await fetch('/api/transactions/transfer', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ senderWalletId: walletId, receiverEmail: email, amount, description: desc }) });
      const data = await res.json();
      if (res.ok) { fetchWallets(); fetchTransactions(); }
      else throw new Error(data.error);
    } catch (err: any) {
      if (err?.message && !err.message.includes('fetch')) {
        fire('Transfer failed', err.message, 'warn');
        return;
      }
      // Demo fallback — backend offline
      setWallets(prev => prev.map(w => w.id === walletId ? { ...w, balance: w.balance - amount } : w));
      setTransactions(prev => [{
        id: Math.random().toString(), senderWalletId: walletId, receiverWalletId: null,
        amount, currency: wallet.currency, status: 'confirmed', type: 'transfer',
        description: desc, createdAt: new Date().toISOString(), reference: 'TX-' + Math.random().toString(36).slice(2,8).toUpperCase(),
      } as any, ...prev]);
    }
  };

  const handleRequest = async (_email: string, _amount: number, _desc: string) => {
    await Promise.resolve();
    fire('Request sent', `They'll receive a notification to pay you.`, 'success');
  };

  const handleDeposit = async () => {
    const amt = parseFloat(depositAmt);
    if (!amt || amt <= 0) return;
    setDepositLoading(true);
    const selectedId = depositWalletId || wallets[0]?.id;
    const wallet = wallets.find(w => w.id === selectedId) || wallets[0];
    try {
      const res = await fetch('/api/wallets/deposit', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ walletId: wallet.id, amount: amt }) });
      if (res.ok) { 
        fetchWallets(); 
        fetchTransactions(); 
        fire('Deposit successful', `${money(amt, wallet.currency)} added to your ${wallet.name || (wallet.type === 'savings' ? 'Savings Vault' : wallet.type === 'travel' ? 'Travel Multi-Currency' : 'Everyday Checking')} account.`, 'success'); 
      }
      else throw new Error();
    } catch {
      setWallets(prev => prev.map(w => w.id === wallet.id ? { ...w, balance: w.balance + amt } : w));
      setTransactions(prev => [{
        id: Math.random().toString(), senderWalletId: null, receiverWalletId: wallet.id,
        amount: amt, currency: wallet.currency || 'EUR', status: 'confirmed', type: 'deposit',
        description: 'Cash deposit', createdAt: new Date().toISOString(),
      }, ...prev]);
      fire('Deposit added (demo)', `${money(amt, wallet.currency)} deposited via demo simulator.`, 'success');
    } finally {
      setDepositLoading(false);
      setDepositAmt('');
      setDepositOpen(false);
    }
  };

  const handleOwnTransfer = async (fromWalletId: string, toWalletId: string, amount: number, description: string): Promise<void> => {
    const fromWallet = wallets.find(w => w.id === fromWalletId);
    const toWallet   = wallets.find(w => w.id === toWalletId);
    if (!fromWallet || !toWallet) { fire('Error', 'Account not found.', 'warn'); return; }

    try {
      const res = await fetch('/api/transactions/own-transfer', {
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
        throw new Error((await res.json()).error || 'Transfer failed');
      }
    } catch (err: any) {
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
        createdAt: new Date().toISOString(),
      }, ...prev]);
      fire('Transfer complete (demo)', `${money(amount)} moved to ${toWallet.name || toWallet.type}.`, 'success');
    }
  };

  const handleUpgradePlan = async (newPlan: string) => {
    if (!token || token === 'mock-token') {
      setRawUser((prev: any) => prev ? { ...prev, plan: newPlan } : null);
      fire('Success', `Welcome to FinVault ${newPlan}! Your new perks are live.`, 'success');
      return;
    }
    try {
      const res = await fetch('/api/users/plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: newPlan })
      });
      if (res.ok) {
        const updatedUser = await res.json();
        setRawUser(updatedUser);
        fire('Success', `Welcome to FinVault ${newPlan}! Your new perks are live.`, 'success');
      }
    } catch (e: any) {
      fire('Error', 'Failed to upgrade plan: ' + e.message, 'error');
    }
  };

  // Build derived data
  const firstName = rawUser?.profile?.firstName || rawUser?.firstName || 'Tom';
  const lastName  = rawUser?.profile?.lastName  || rawUser?.lastName  || 'Bomeke';
  const email     = rawUser?.email || 'tom@finvault.com';
  const appData   = buildMockData(firstName, lastName, email, wallets, transactions, cards, goals, rawUser?.plan || 'Metal');

  // --- Route → Screen ---
  const renderScreen = () => {
    // Account dashboard: 'account:walletId'
    if (route.startsWith('account:')) {
      const walletId = route.replace('account:', '');
      return (
        <ScreenAccountDashboard
          walletId={walletId}
          compact={compact}
          navigate={setRoute}
          data={appData}
          onOwnTransfer={handleOwnTransfer}
          fire={fire}
        />
      );
    }
    switch (route) {
      case 'overview':
        return <ScreenOverview compact={compact} navigate={setRoute} data={appData} onTopup={() => setDepositOpen(true)} />;
      case 'transactions':
        return <ScreenTransactions compact={compact} data={appData} onExport={() => fire('Export', 'CSV download will start shortly.', 'info')} />;
      case 'transfer':
        return <ScreenTransfer compact={compact} navigate={setRoute} fire={fire} data={appData} onTransfer={handleTransfer} onRequest={handleRequest} />;
      case 'cards':
        return <ScreenCards compact={compact} data={appData} fire={fire} cards={cards} setCards={setCards} token={token} navigate={setRoute} />;
      case 'analytics':
        return <ScreenAnalytics compact={compact} data={appData} />;
      case 'savings':
        return <ScreenSavings compact={compact} fire={fire} goals={goals} setGoals={setGoals} wallets={wallets} setWallets={setWallets} setTransactions={setTransactions} token={token} />;
      case 'settings':
        return (
          <ScreenSettings
            compact={compact}
            theme={theme}
            setTheme={(t) => { if (typeof t === 'object') setThemeState(t); }}
            fire={fire}
            openUpgrade={() => setUpgradeOpen(true)}
            onLogout={handleLogout}
            data={appData}
          />
        );
      default:
        return <ScreenOverview compact={compact} navigate={setRoute} data={appData} onTopup={() => setDepositOpen(true)} />;
    }
  };

  // Loading screen while verifying token
  if (authLoading) {
    const loader = (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', flexDirection: 'column', gap: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 'var(--r)', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fvPop .5s cubic-bezier(.22,.9,.3,1)' }}>
          <Icon name="shield" size={24} style={{ color: 'var(--on-accent)' }} />
        </div>
        <div className="shimmer" style={{ width: 120, height: 6, borderRadius: 99 }} />
      </div>
    );
    if (isMobileMode) {
      const scale = Math.min(1, (vh - 36) / 874, (vw - 24) / 402);
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, background: 'var(--bg-grad)' }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
            <IOSDevice dark={theme.mode === 'dark'} width={402} height={874}>{loader}</IOSDevice>
          </div>
        </div>
      );
    }
    return loader;
  }

  // Auth gate
  if (!token || !rawUser) {
    // Show the marketing landing page at root (desktop only — not inside the mobile frame)
    if (location.pathname === '/' && !isMobileMode) {
      return (
        <ScreenLanding
          onGetStarted={() => navigate('/login', { state: { register: true } })}
          onLogin={() => navigate('/login')}
        />
      );
    }

    const initialMode: 'login' | 'register' = (location.state as any)?.register ? 'register' : 'login';
    const loginScreen = (
      <ScreenAuth
        compact={compact}
        onLogin={handleLogin}
        onRegister={handleRegister}
        authError={authError}
        authSuccess={authSuccess}
        initialMode={initialMode}
      />
    );
    if (isMobileMode) {
      const scale = Math.min(1, (vh - 36) / 874, (vw - 24) / 402);
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, background: 'var(--bg-grad)' }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
            <IOSDevice dark={theme.mode === 'dark'} width={402} height={874}>
              <div style={{ width: 402, minHeight: '100%', paddingTop: 36, background: 'var(--bg)', color: 'var(--text)' }}>{loginScreen}</div>
            </IOSDevice>
          </div>
        </div>
      );
    }
    return <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>{loginScreen}</div>;
  }

  const depositSheet = (
    <Sheet open={depositOpen} onClose={() => setDepositOpen(false)} title="Top up your account" mobile={compact}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
        <p style={{ color: 'var(--text-2)', fontSize: '0.92rem' }}>Add funds to your account instantly.</p>
        
        <label className="label">Destination Account</label>
        <select 
          className="field" 
          value={depositWalletId || (wallets[0]?.id || '')} 
          onChange={e => setDepositWalletId(e.target.value)}
          style={{ width: '100%', padding: '10px', borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--line)' }}
        >
          {wallets.map(w => (
            <option key={w.id} value={w.id}>
              {w.name || (w.type === 'savings' ? 'Savings Vault' : w.type === 'travel' ? 'Travel Multi-Currency' : 'Everyday Checking')} ({w.currency} - {w.iban.substring(w.iban.length - 4)})
            </option>
          ))}
        </select>

        <label className="label">Amount</label>
        <input className="field num" autoFocus value={depositAmt} onChange={e => setDepositAmt(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 700 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {[50, 100, 250, 500].map(v => (
            <button key={v} onClick={() => setDepositAmt(String(v))} className="chip" style={{ flex: 1, justifyContent: 'center', cursor: 'pointer', padding: '9px 0' }}>€{v}</button>
          ))}
        </div>
        <button className="btn btn-primary btn-block" onClick={handleDeposit} disabled={depositLoading || !parseFloat(depositAmt)}>
          {depositLoading ? 'Processing…' : `Add ${depositAmt ? money(parseFloat(depositAmt)) : 'funds'}`}
        </button>
      </div>
    </Sheet>
  );

  const appContent = (
    <Shell
      route={route}
      setRoute={setRoute}
      compact={compact}
      onLogout={handleLogout}
      fire={fire}
      toast={toast}
      upgradeOpen={upgradeOpen}
      openUpgrade={() => setUpgradeOpen(true)}
      closeUpgrade={() => setUpgradeOpen(false)}
      user={{ firstName, lastName, initials: `${firstName[0]}${lastName[0]}`.toUpperCase(), plan: `FinVault ${rawUser?.plan || 'Metal'}` }}
      notifications={notifications as any}
      embedded={isMobileMode}
      onUpgrade={handleUpgradePlan}
    >
      {renderScreen()}
    </Shell>
  );

  if (isMobileMode) {
    const scale = Math.min(1, (vh - 36) / 874, (vw - 24) / 402);
    return (
      <>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, background: 'var(--bg-grad)' }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
            <IOSDevice dark={theme.mode === 'dark'} width={402} height={874}>
              <div style={{ width: 402, minHeight: '100%', background: 'var(--bg)', color: 'var(--text)' }}>{appContent}</div>
            </IOSDevice>
          </div>
        </div>
        {depositSheet}
      </>
    );
  }

  return (
    <>
      {appContent}
      {depositSheet}
    </>
  );
}
