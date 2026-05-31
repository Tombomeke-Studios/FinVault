export interface Wallet {
  id: string; name: string; type: 'checking' | 'savings'; currency: string;
  iban: string; balance: number; reserved: number; interest: number; color: string;
  credit?: { limit: number; used: number };
}
export interface Card {
  id: string; name: string; kind: 'physical' | 'virtual'; network: string;
  last4: string; number: string; cvv: string; holder: string; exp: string;
  frozen: boolean; scheme: string; walletId: string; monthSpend: number; limit: number;
}
export interface Transaction {
  id: string; name: string; amount: number; category: string;
  method: string; ts: number; status: string; ref: string;
}
export interface Goal { id: string; name: string; target: number; saved: number; hue: number; icon: string; due: string; }
export interface Contact { id: string; name: string; handle: string; initials: string; hue: number; }
export interface PayRequest { id: string; name: string; dir: 'incoming' | 'outgoing'; amount: number; note: string; ts: number; status: 'pending' | 'paid'; }
export interface Category { label: string; hue: number; icon: string; }
export interface SpendByCat { cat: string; amount: number; }
export interface MonthlyFlow { m: string; in: number; out: number; }

const now = Date.now();
const day = 86400000;
const iso = (ms: number) => new Date(ms).toISOString();

export const CATS: Record<string, Category> = {
  income:    { label: 'Income',            hue: 158, icon: 'arrowDownLeft' },
  transfer:  { label: 'Transfers',         hue: 265, icon: 'send' },
  groceries: { label: 'Groceries',         hue: 130, icon: 'cart' },
  dining:    { label: 'Dining & Cafés',    hue: 28,  icon: 'coffee' },
  transport: { label: 'Transport',         hue: 230, icon: 'car' },
  shopping:  { label: 'Shopping',          hue: 320, icon: 'bag' },
  bills:     { label: 'Bills & Utilities', hue: 200, icon: 'bolt' },
  subs:      { label: 'Subscriptions',     hue: 300, icon: 'repeat' },
  health:    { label: 'Health',            hue: 12,  icon: 'heart' },
  travel:    { label: 'Travel',            hue: 195, icon: 'plane' },
};

export const user = {
  firstName: 'Tom', lastName: 'Bomeke', email: 'tom@finvault.com',
  initials: 'TB', accountType: 'personal', memberSince: '2021', plan: 'FinVault Metal',
};

export const wallets: Wallet[] = [
  { id: 'w-main', name: 'Everyday', type: 'checking', currency: 'EUR', iban: 'BE89 3770 0771 9941', balance: 4182.55, reserved: 120.00, interest: 0, color: 'accent', credit: { limit: 1500, used: 0 } },
  { id: 'w-save', name: 'Savings Vault', type: 'savings', currency: 'EUR', iban: 'BE89 3770 0771 8822', balance: 18540.00, reserved: 0, interest: 0.025, color: 'gold' },
  { id: 'w-usd', name: 'Travel USD', type: 'checking', currency: 'USD', iban: 'BE71 0961 2345 6769', balance: 920.40, reserved: 0, interest: 0, color: 'cyan' },
];

export const balanceTrend = [3120, 3090, 3380, 3290, 3550, 3510, 3870, 3820, 3760, 3990, 4210, 4060, 4310, 4182.55];

export const cards: Card[] = [
  { id: 'c-metal', name: 'FinVault Metal', kind: 'physical', network: 'Visa', last4: '4417', number: '4972 1183 5567 4417', cvv: '318', holder: 'TOM BOMEKE', exp: '09/28', frozen: false, scheme: 'metal', walletId: 'w-main', monthSpend: 1240.18, limit: 3000 },
  { id: 'c-virt', name: 'Online Virtual', kind: 'virtual', network: 'Mastercard', last4: '8830', number: '5318 7720 4491 8830', cvv: '742', holder: 'TOM BOMEKE', exp: '02/27', frozen: false, scheme: 'violet', walletId: 'w-main', monthSpend: 318.90, limit: 1000 },
  { id: 'c-trav', name: 'Travel USD', kind: 'virtual', network: 'Visa', last4: '1192', number: '4023 6698 1145 1192', cvv: '905', holder: 'TOM BOMEKE', exp: '11/26', frozen: true, scheme: 'cyan', walletId: 'w-usd', monthSpend: 0, limit: 1500 },
];

const rawTx: [string, number, string, number, string][] = [
  ['Spotify Premium', -11.99, 'subs', 0.2, 'Mastercard ·· 8830'],
  ['Albert Heijn', -38.42, 'groceries', 0.4, 'Metal ·· 4417'],
  ['Salary — Tombomeke Studios', 3200.00, 'income', 1, 'SEPA credit'],
  ['Starbucks Centraal', -4.80, 'dining', 1.2, 'Metal ·· 4417'],
  ['NMBS Train', -12.40, 'transport', 1.6, 'Metal ·· 4417'],
  ['Bol.com', -64.99, 'shopping', 2.2, 'Mastercard ·· 8830'],
  ['Lena Mertens', -45.00, 'transfer', 2.5, 'P2P transfer'],
  ['Engie Energy', -89.30, 'bills', 3.1, 'SEPA direct debit'],
  ['Delhaize', -52.15, 'groceries', 3.6, 'Metal ·· 4417'],
  ['Apple Services', -2.99, 'subs', 4.0, 'Mastercard ·· 8830'],
  ['Uber', -16.20, 'transport', 4.4, 'Metal ·· 4417'],
  ['Pizza Da Vinci', -28.50, 'dining', 5.2, 'Metal ·· 4417'],
  ['Refund — Zalando', 34.95, 'shopping', 5.8, 'Mastercard ·· 8830'],
  ['Proximus Mobile', -25.00, 'bills', 6.3, 'SEPA direct debit'],
  ['Decathlon', -79.99, 'shopping', 7.1, 'Metal ·· 4417'],
  ['Brussels Airlines', -214.00, 'travel', 8.0, 'Mastercard ·· 8830'],
  ['Carrefour Express', -19.74, 'groceries', 8.5, 'Metal ·· 4417'],
  ['Netflix', -13.99, 'subs', 9.1, 'Mastercard ·· 8830'],
  ['Pharmacy De Wit', -8.60, 'health', 9.7, 'Metal ·· 4417'],
  ['To Savings Vault', -500.00, 'transfer', 10.2, 'Internal transfer'],
  ['Coffee Labs', -3.40, 'dining', 11.0, 'Metal ·· 4417'],
  ['Salary — Tombomeke Studios', 3200.00, 'income', 31, 'SEPA credit'],
];

let txid = 1000;
export const transactions: Transaction[] = rawTx.map(([name, amount, cat, daysAgo, method]) => ({
  id: 'tx-' + (txid++), name, amount, category: cat, method,
  ts: now - Math.round(daysAgo * day), status: 'confirmed',
  ref: 'FV' + Math.floor(100000 + Math.random() * 899999),
}));

export const goals: Goal[] = [
  { id: 'g-japan', name: 'Japan Trip', target: 4000, saved: 2680, hue: 12, icon: 'plane', due: 'Oct 2026' },
  { id: 'g-emerg', name: 'Emergency Fund', target: 10000, saved: 8200, hue: 158, icon: 'shield', due: 'No date' },
  { id: 'g-mac', name: 'New MacBook', target: 2500, saved: 900, hue: 265, icon: 'laptop', due: 'Mar 2026' },
  { id: 'g-car', name: 'Car Deposit', target: 6000, saved: 1500, hue: 230, icon: 'car', due: 'Jul 2027' },
];

export const requests: PayRequest[] = [
  { id: 'r1', name: 'Lena Mertens', dir: 'incoming', amount: 22.50, note: 'Dinner split', ts: now - day * 0.3, status: 'pending' },
  { id: 'r2', name: 'Sam Janssens', dir: 'outgoing', amount: 60.00, note: 'Concert tickets', ts: now - day * 1.1, status: 'pending' },
  { id: 'r3', name: 'Maya Peeters', dir: 'incoming', amount: 15.00, note: 'Taxi', ts: now - day * 2.4, status: 'paid' },
];

export const contacts: Contact[] = [
  { id: 'p1', name: 'Lena Mertens', handle: 'lena@finvault.com', initials: 'LM', hue: 320 },
  { id: 'p2', name: 'Sam Janssens', handle: 'sam@finvault.com', initials: 'SJ', hue: 230 },
  { id: 'p3', name: 'Maya Peeters', handle: 'maya@finvault.com', initials: 'MP', hue: 158 },
  { id: 'p4', name: 'Noah De Smet', handle: 'noah@finvault.com', initials: 'ND', hue: 28 },
  { id: 'p5', name: 'Eva Claes', handle: 'eva@finvault.com', initials: 'EC', hue: 265 },
];

export const spendByCat: SpendByCat[] = [
  { cat: 'groceries', amount: 410 }, { cat: 'dining', amount: 235 }, { cat: 'shopping', amount: 320 },
  { cat: 'transport', amount: 96 }, { cat: 'bills', amount: 204 }, { cat: 'subs', amount: 58 },
  { cat: 'travel', amount: 214 }, { cat: 'health', amount: 42 },
];

export const monthly: MonthlyFlow[] = [
  { m: 'Dec', in: 3200, out: 2410 }, { m: 'Jan', in: 3200, out: 2780 },
  { m: 'Feb', in: 3460, out: 2210 }, { m: 'Mar', in: 3200, out: 2980 },
  { m: 'Apr', in: 3540, out: 2540 }, { m: 'May', in: 3200, out: 1879 },
];

export const FV = { user, wallets, cards, transactions, goals, requests, contacts, spendByCat, monthly, balanceTrend, CATS, iso };
