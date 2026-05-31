import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity, Text, StatusBar, Modal, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import { ScreenAuth } from './src/screens/ScreenAuth';
import { ScreenOverview } from './src/screens/ScreenOverview';
import { ScreenTransactions } from './src/screens/ScreenTransactions';
import { ScreenTransfer } from './src/screens/ScreenTransfer';
import { ScreenCards } from './src/screens/ScreenCards';
import { ScreenSavings } from './src/screens/ScreenSavings';
import { ScreenSettings } from './src/screens/ScreenSettings';
import { Shell } from './src/components/Shell';
import { money } from './src/components/UI';
import { MobileSheet } from './src/components/MobileExtras';
import { THEME } from './src/theme';

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
  { name: 'Standard', price: '€0',     tag: 'Gratis',       feats: ['1 kaart', '€200/mo gratis ATM', 'P2P transfers'] },
  { name: 'Metal',    price: '€9,99',  tag: 'Populair',     feats: ['3 kaarten', '€2.000/mo gratis ATM', 'Prioriteit support'] },
  { name: 'Metal+',   price: '€16,99', tag: 'Beste waarde', feats: ['Onbeperkte kaarten', 'Onbeperkt ATM', 'Reisverzekerering', '3% spaarrente'] },
];

function UpgradePlanSheet({ open, onClose, currentPlan, onUpgrade }: { open: boolean; onClose: () => void; currentPlan: string; onUpgrade: (p: string) => void }) {
  const [sel, setSel] = React.useState(currentPlan);

  React.useEffect(() => { if (open) setSel(currentPlan); }, [open, currentPlan]);

  return (
    <MobileSheet open={open} onClose={onClose} title="Kies jouw abonnement">
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
            >
              <View style={upgStyles.planHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[upgStyles.planName, active ? upgStyles.planNameActive : null]}>{p.name}</Text>
                  {isCurrent && <View style={upgStyles.chip}><Text style={upgStyles.chipTxt}>Huidig</Text></View>}
                </View>
                <Text style={[upgStyles.planPrice, active ? upgStyles.planNameActive : null]}>{p.price}<Text style={upgStyles.planPer}>/mo</Text></Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {p.feats.map(f => <Text key={f} style={upgStyles.feat}>✓ {f}</Text>)}
              </View>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[upgStyles.confirmBtn, sel === currentPlan ? upgStyles.confirmBtnMuted : null]}
          onPress={() => sel !== currentPlan ? onUpgrade(sel) : onClose()}
          activeOpacity={0.85}
        >
          <Text style={upgStyles.confirmTxt}>{sel === currentPlan ? 'Huidig abonnement' : `Overstappen naar ${sel}`}</Text>
        </TouchableOpacity>
      </View>
    </MobileSheet>
  );
}

const upgStyles = StyleSheet.create({
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
  confirmTxt: { fontSize: 15, fontWeight: 'bold', color: '#fff' },
});

export default function App() {
  // --- Auth State ---
  const [token, setToken] = useState<string | null>(null);
  const [rawUser, setRawUser] = useState<any>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<CardItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [upgradeOpen, setUpgradeOpen] = useState(false);

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
  const [depositAmt, setDepositAmt] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);
  const [theme, setTheme] = useState<ThemeConfig>({
    mode: 'dark', accent: 'emerald', font: 'grotesk', radius: 'soft', density: 'regular', card: 'elevated'
  });

  const fire = useCallback((title: string, body: string, type: string = 'info') => {
    Alert.alert(title, body);
  }, []);

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

  const API_URL = 'http://192.168.0.6:8000';

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
      } else {
        setToken(null);
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
        setToken(data.accessToken);
        setAuthSuccess('Welcome back!');
      } else {
        const errorData = await res.json();
        setAuthError(errorData.error || errorData.message || 'Invalid credentials.');
      }
    } catch {
      // Offline fallback
      if (email === 'admin@finvault.com' || email === 'tom@finvault.com') {
        setToken('mock-token');
        setupMockSession();
        setAuthSuccess('Welcome back (Demo mode)!');
      } else {
        setAuthError('Offline — use admin@finvault.com to log in as demo.');
      }
    }
  };

  const handleFaceIdLogin = () => {
    setAuthError('');
    setAuthSuccess('');
    setRawUser(null);
    setToken('mock-token');
    setupMockSession();
    setAuthSuccess('Face ID scan successful!');
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

  const handleLogout = () => {
    setToken(null);
    setRawUser(null);
    setCards([]);
    setGoals([]);
  };

  const handleUpgradePlan = async (newPlan: string) => {
    if (!token || token === 'mock-token') {
      setRawUser((prev: any) => prev ? { ...prev, plan: newPlan } : null);
      fire('Gelukt', `Welkom bij FinVault ${newPlan}!`, 'success');
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
        fire('Gelukt', `Welkom bij FinVault ${newPlan}!`, 'success');
      }
    } catch {
      fire('Fout', 'Abonnement wijzigen mislukt.', 'warn');
    }
  };

  const handleTransfer = async (email: string, amount: number, desc: string, walletId: string) => {
    const wallet = wallets.find(w => w.id === walletId) || wallets[0];
    if (!wallet) return;

    if (token && token !== 'mock-token') {
      try {
        const res = await fetch(`${API_URL}/api/transactions/transfer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ receiverEmail: email, amount, description: desc, senderWalletId: walletId })
        });
        if (res.ok) {
          fire('Transfer completed', `${money(amount)} sent to ${email}.`, 'success');
          fetchWallets();
          fetchTransactions();
          return;
        } else {
          const err = await res.json();
          Alert.alert('Transfer failed', err.message || 'Could not complete transfer.');
          return;
        }
      } catch {
        // Fallback
      }
    }

    setWallets(prev => prev.map(w => w.id === walletId ? { ...w, balance: w.balance - amount } : w));
    setTransactions(prev => [{
      id: Math.random().toString(), senderWalletId: walletId, receiverWalletId: null,
      amount, currency: wallet.currency, status: 'confirmed', type: 'transfer',
      description: desc, createdAt: new Date().toISOString()
    }, ...prev]);
    fire('Transfer completed (Demo)', `${money(amount)} sent to ${email}.`, 'success');
  };

  const handleRequest = async (email: string, amount: number, desc: string) => {
    fire('Request sent', `Payment request of ${money(amount)} sent to ${email}.`, 'success');
  };

  const handleDeposit = () => {
    const val = parseFloat(depositAmt);
    if (!val || val <= 0) return;

    setDepositLoading(true);

    if (token && token !== 'mock-token') {
      fetch(`${API_URL}/api/transactions/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount: val, description: 'Cash deposit', receiverWalletId: wallets[0]?.id })
      }).then(res => {
        if (res.ok) {
          fire('Deposit added', `${money(val)} deposited into your checking account.`, 'success');
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
        setWallets(prev => prev.map((w, i) => i === 0 ? { ...w, balance: w.balance + val } : w));
        setTransactions(prev => [{
          id: Math.random().toString(), senderWalletId: null, receiverWalletId: wallets[0].id,
          amount: val, currency: 'EUR', status: 'confirmed', type: 'deposit',
          description: 'Cash deposit', createdAt: new Date().toISOString()
        } as any, ...prev]);
        setDepositLoading(false);
        setDepositAmt('');
        setDepositOpen(false);
        fire('Deposit added (Demo)', `${money(val)} deposited into your checking account.`, 'success');
      });
      return;
    }

    setTimeout(() => {
      setWallets(prev => prev.map((w, i) => i === 0 ? { ...w, balance: w.balance + val } : w));
      setTransactions(prev => [{
        id: Math.random().toString(), senderWalletId: null, receiverWalletId: wallets[0].id,
        amount: val, currency: 'EUR', status: 'confirmed', type: 'deposit',
        description: 'Cash deposit', createdAt: new Date().toISOString()
      } as any, ...prev]);
      setDepositLoading(false);
      setDepositAmt('');
      setDepositOpen(false);
      fire('Deposit added (Demo)', `${money(val)} deposited into your checking account.`, 'success');
    }, 800);
  };

  const firstName = rawUser?.profile?.firstName || rawUser?.firstName || 'Tom';
  const lastName  = rawUser?.profile?.lastName  || rawUser?.lastName  || 'Bomeke';
  const email     = rawUser?.email || 'tom@finvault.com';
  const appData   = buildMockData(firstName, lastName, email, wallets, transactions, cards, goals, rawUser?.plan || 'Metal');

  const renderScreen = () => {
    switch (route) {
      case 'overview':
        return <ScreenOverview navigate={setRoute} data={appData} onTopup={() => setDepositOpen(true)} />;
      case 'transactions':
        return <ScreenTransactions data={appData} onExport={() => fire('Export ledger', 'Ledger CSV export completed.')} />;
      case 'transfer':
        return <ScreenTransfer data={appData} onTransfer={handleTransfer} onRequest={handleRequest} />;
      case 'cards':
        return <ScreenCards data={appData} fire={fire} cards={cards} setCards={setCards} token={token} apiUrl={API_URL} />;
      case 'savings':
        return <ScreenSavings data={appData} fire={fire} goals={goals} setGoals={setGoals} wallets={wallets} setWallets={setWallets} setTransactions={setTransactions} token={token} apiUrl={API_URL} />;
      case 'settings':
        return <ScreenSettings data={appData} theme={theme} setTheme={setTheme} onLogout={handleLogout} fire={fire} openUpgrade={() => setUpgradeOpen(true)} />;
      default:
        return <ScreenOverview navigate={setRoute} data={appData} onTopup={() => setDepositOpen(true)} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Auth Screen or Main application shell */}
      {!token ? (
        <ScreenAuth
          onLogin={handleLogin}
          onRegister={handleRegister}
          authError={authError}
          authSuccess={authSuccess}
          onFaceIdLogin={handleFaceIdLogin}
        />
      ) : (
        <Shell route={route} setRoute={setRoute} user={appData.user}>
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

      {/* Dynamic topup modal sheet */}
      <MobileSheet open={depositOpen} onClose={() => setDepositOpen(false)} title="Top up Everyday Account">
        <View style={styles.sheetForm}>
          <Text style={styles.sheetDesc}>Top up your Everyday checking account balance instantly.</Text>
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

          <TouchableOpacity style={styles.submitBtn} onPress={handleDeposit} disabled={depositLoading || !depositAmt}>
            <Text style={styles.submitText}>{depositLoading ? 'Processing…' : 'Deposit'}</Text>
          </TouchableOpacity>
        </View>
      </MobileSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0,
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
});
