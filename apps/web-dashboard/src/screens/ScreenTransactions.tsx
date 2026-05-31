import React, { useState, useMemo } from 'react';
import { Icon } from '../components/Icon';
import { money, dayLabel, relTime, CategoryIcon, PageHead } from '../components/UI';
import type { AppData } from '../App';

const CATS_META: Record<string, { label: string; hue: number; icon: string }> = {
  income:    { label: 'Income',           hue: 158, icon: 'arrowDownLeft' },
  transfer:  { label: 'Transfers',        hue: 265, icon: 'send' },
  groceries: { label: 'Groceries',        hue: 130, icon: 'cart' },
  dining:    { label: 'Dining & Cafés',   hue: 28,  icon: 'coffee' },
  transport: { label: 'Transport',        hue: 230, icon: 'car' },
  shopping:  { label: 'Shopping',         hue: 320, icon: 'bag' },
  bills:     { label: 'Bills & Utilities',hue: 200, icon: 'bolt' },
  subs:      { label: 'Subscriptions',    hue: 300, icon: 'repeat' },
  health:    { label: 'Health',           hue: 12,  icon: 'heart' },
  travel:    { label: 'Travel',           hue: 195, icon: 'plane' },
  deposit:   { label: 'Deposit',          hue: 158, icon: 'arrowDownLeft' },
};

interface TransactionsProps {
  compact: boolean;
  data: AppData;
  onExport: () => void;
}

interface TxItem {
  id: string;
  description: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  receiverWalletId: string | null;
  senderWalletId: string | null;
}

export function ScreenTransactions({ compact, data, onExport }: TransactionsProps) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');

  // Convert backend transactions to display format
  const txList = useMemo(() => data.transactions.map(t => ({
    ...t,
    name: t.description || 'Transaction',
    category: t.type === 'deposit' ? 'deposit' : 'transfer',
    ts: new Date(t.createdAt).getTime(),
    method: t.senderWalletId ? 'From wallet' : 'External',
  })), [data.transactions]);

  const filtered = useMemo(() =>
    txList.filter(t =>
      (cat === 'all' || t.category === cat) &&
      (q === '' || t.name.toLowerCase().includes(q.toLowerCase()))
    ), [q, cat, txList]);

  const groups = useMemo(() => {
    const m: Record<string, typeof filtered> = {};
    filtered.forEach(t => { const k = dayLabel(t.ts); (m[k] = m[k] || []).push(t); });
    return Object.entries(m);
  }, [filtered]);

  const getDisplayAmt = (t: TxItem) => {
    const amt = typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount));
    const isIncoming = t.receiverWalletId && data.wallets.some(w => w.id === t.receiverWalletId);
    return isIncoming ? amt : -amt;
  };

  const monthIn = filtered.filter(t => getDisplayAmt(t) > 0).reduce((s, t) => s + getDisplayAmt(t), 0);
  const monthOut = filtered.filter(t => getDisplayAmt(t) < 0).reduce((s, t) => s + getDisplayAmt(t), 0);

  const cats = ['all', 'deposit', 'transfer'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
      <PageHead title="Transactions" subtitle="Your immutable account ledger." action={
        <button className="btn btn-ghost" onClick={onExport}><Icon name="download" size={17} /> {compact ? '' : 'Export'}</button>
      } />

      {/* summary */}
      <div style={{ display: 'flex', gap: 'var(--gap)' }}>
        {[['Money in', monthIn, 'pos', 'arrowDownLeft'], ['Money out', monthOut, 'neg', 'arrowUpRight'], ['Net', monthIn + monthOut, (monthIn + monthOut) >= 0 ? 'pos' : 'neg', 'trend']].map(([l, v, k, ic]) => (
          <div key={l as string} className="card" style={{ flex: 1, padding: 'var(--pad)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in oklab, var(--${k}) 16%, transparent)`, color: `var(--${k})` }}><Icon name={ic as string} size={18} /></span>
            <div><div style={{ fontSize: '0.76rem', color: 'var(--text-3)' }}>{l}</div><div className="num" style={{ fontWeight: 700, fontSize: '1.05rem' }}>{money(v as number, 'EUR', { signed: true })}</div></div>
          </div>
        ))}
      </div>

      {/* search */}
      <div style={{ position: 'relative' }}>
        <Icon name="search" size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
        <input className="field" value={q} onChange={e => setQ(e.target.value)} placeholder="Search transactions" style={{ paddingLeft: 42 }} />
      </div>

      {/* category filter */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }} className="hide-scroll">
        {cats.map(c => (
          <button key={c} onClick={() => setCat(c)} className="chip" style={{
            cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
            background: cat === c ? 'var(--accent)' : 'var(--surface-2)',
            color: cat === c ? 'var(--on-accent)' : 'var(--text-2)',
            borderColor: cat === c ? 'transparent' : 'var(--line)',
          }}>{c === 'all' ? 'All' : (CATS_META[c]?.label || c)}</button>
        ))}
      </div>

      {/* groups */}
      <div className="card" style={{ padding: 'var(--pad)' }}>
        {groups.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>No transactions found.</div>}
        {groups.map(([day, items]) => (
          <div key={day}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 6px 8px', position: 'sticky', top: 0, background: 'var(--surface)' }}>
              <span className="eyebrow">{day}</span>
              <span className="num" style={{ fontSize: '0.76rem', color: 'var(--text-3)', fontWeight: 600 }}>
                {money(items.reduce((s, t) => s + getDisplayAmt(t), 0), 'EUR', { signed: true })}
              </span>
            </div>
            {items.map(t => {
              const dAmt = getDisplayAmt(t);
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 6px', borderTop: '1px solid var(--line)' }}>
                  <CategoryIcon cat={t.category} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t.name}</div>
                    <div style={{ color: 'var(--text-3)', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.method} · {relTime(t.ts)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="num" style={{ fontWeight: 700, color: dAmt > 0 ? 'var(--pos)' : 'var(--text)' }}>{money(dAmt, 'EUR', { signed: true })}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}><Icon name="check" size={11} /> {t.status}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
