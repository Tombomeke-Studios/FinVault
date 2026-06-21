import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../components/Icon';
import { money, PageHead } from '../components/UI';

interface Props {
  compact: boolean; token: string; navigate: (r: string) => void;
  wallets: { id: string; type: string; currency: string; balance: number }[];
  fire: (t: string, b: string, type?: string) => void;
  onRefresh: () => void;
}

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'SEK', 'NOK', 'DKK'];

export function ScreenFxExchange({ compact, token, navigate, wallets, fire, onRefresh }: Props) {
  const [rates, setRates] = useState<Record<string, Record<string, number>>>({});
  const [fromCurrency, setFromCurrency] = useState('EUR');
  const [toCurrency, setToCurrency] = useState('USD');
  const [amt, setAmt] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchRates = useCallback(async () => {
    try { const res = await fetch('/api/fx/rates', { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setRates(await res.json()); } catch {}
  }, [token]);
  useEffect(() => { fetchRates(); }, [fetchRates]);

  const fromWallet = wallets.find(w => w.currency === fromCurrency);
  const toWallet = wallets.find(w => w.currency === toCurrency);
  const rate = rates[fromCurrency]?.[toCurrency] || 0;
  const val = parseFloat(amt) || 0;
  const converted = parseFloat((val * rate).toFixed(2));

  const exchange = async () => {
    if (!fromWallet || !toWallet || val <= 0 || !rate) return;
    setLoading(true);
    try {
      const res = await fetch('/api/fx/exchange', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ fromWalletId: fromWallet.id, toWalletId: toWallet.id, amount: val, fromCurrency, toCurrency }) });
      if (res.ok) { fire('Done', `${val} ${fromCurrency} → ${converted} ${toCurrency}`, 'success'); setAmt(''); onRefresh(); }
      else { const e = await res.json(); fire('Error', e.error || 'Failed.', 'error'); }
    } catch { fire('Error', 'Failed.', 'error'); }
    setLoading(false);
  };

  return (
    <div style={{ padding: compact ? 16 : 24, maxWidth: 560, margin: '0 auto' }}>
      <PageHead title="Currency Exchange" back={compact ? () => navigate('overview') : undefined} />
      <div className="card" style={{ padding: 24 }}>
        <div className="eyebrow">From</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {CURRENCIES.filter(c => wallets.some(w => w.currency === c)).map(c => (
            <button key={c} className={`chip ${fromCurrency === c ? 'chip--active' : ''}`} onClick={() => setFromCurrency(c)}>{c}</button>
          ))}
        </div>
        {fromWallet && <div style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginBottom: 12 }}>Balance: {money(fromWallet.balance, fromWallet.currency)}</div>}
        <input className="field" style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 600 }} placeholder="Amount" value={amt} onChange={e => setAmt(e.target.value)} type="number" min="0" step="0.01" />
        <div style={{ textAlign: 'center', margin: '16px 0' }}>
          <Icon name="arrow-down-left" size={22} style={{ color: 'var(--accent)' }} />
          {rate > 0 && <div style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: 4 }}>1 {fromCurrency} = {rate} {toCurrency}</div>}
        </div>
        <div className="eyebrow">To</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {CURRENCIES.filter(c => c !== fromCurrency).map(c => (
            <button key={c} className={`chip ${toCurrency === c ? 'chip--active' : ''}`} onClick={() => setToCurrency(c)}>{c}</button>
          ))}
        </div>
        {val > 0 && rate > 0 && <div style={{ textAlign: 'center', padding: 12, background: 'var(--surface-2)', borderRadius: 'var(--r)', fontWeight: 700, color: 'var(--accent)', fontSize: '1.1rem', marginBottom: 16 }}>You'll receive: {converted} {toCurrency}</div>}
        <button className="btn" style={{ width: '100%' }} onClick={exchange} disabled={loading || !fromWallet || !toWallet || val <= 0 || !rate}>{loading ? 'Exchanging...' : 'Exchange'}</button>
      </div>
    </div>
  );
}
