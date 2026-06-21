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
      if (res.ok) { fire('Exchange complete', `${val} ${fromCurrency} → ${converted} ${toCurrency}`, 'success'); setAmt(''); onRefresh(); }
      else { const e = await res.json(); fire('Error', e.error || 'Exchange failed.', 'error'); }
    } catch { fire('Error', 'Exchange failed.', 'error'); }
    setLoading(false);
  };

  const canExchange = fromWallet && toWallet && val > 0 && rate > 0;

  return (
    <div style={{ padding: compact ? 16 : 24, maxWidth: 560, margin: '0 auto' }}>
      <PageHead title="Currency Exchange" back={compact ? () => navigate('overview') : undefined} />

      <div className="card" style={{ padding: '28px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'color-mix(in oklab, var(--accent) 8%, transparent)' }} />

        {/* From */}
        <div style={{ position: 'relative' }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>You send</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {CURRENCIES.filter(c => wallets.some(w => w.currency === c)).map(c => (
              <button key={c} className={`chip ${fromCurrency === c ? 'chip--active' : ''}`} onClick={() => setFromCurrency(c)} style={{ padding: '6px 14px' }}>{c}</button>
            ))}
          </div>
          {fromWallet && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)', fontSize: '0.82rem', marginBottom: 14 }}>
              <Icon name="credit-card" size={14} />
              <span>Available: <strong className="num" style={{ color: 'var(--text-2)' }}>{money(fromWallet.balance, fromWallet.currency)}</strong></span>
            </div>
          )}
          <input className="field" style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em', padding: '16px' }} placeholder="0.00" value={amt} onChange={e => setAmt(e.target.value)} type="number" min="0" step="0.01" />
        </div>

        {/* Divider with rate */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '20px 0', position: 'relative' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px color-mix(in oklab, var(--accent) 40%, transparent)' }}>
            <Icon name="repeat" size={18} style={{ color: 'var(--on-accent)' }} />
          </div>
          <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        </div>
        {rate > 0 && <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: '0.84rem', marginTop: -12, marginBottom: 12 }}>1 {fromCurrency} = <strong className="num" style={{ color: 'var(--text-2)' }}>{rate}</strong> {toCurrency}</div>}

        {/* To */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>You receive</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {CURRENCIES.filter(c => c !== fromCurrency).map(c => (
              <button key={c} className={`chip ${toCurrency === c ? 'chip--active' : ''}`} onClick={() => setToCurrency(c)} style={{ padding: '6px 14px' }}>{c}</button>
            ))}
          </div>
        </div>

        {/* Preview */}
        {val > 0 && rate > 0 && (
          <div style={{ textAlign: 'center', padding: '14px 16px', background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 'var(--r)', marginBottom: 20 }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginBottom: 4 }}>You'll receive</div>
            <div className="num display" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent)' }}>{converted} {toCurrency}</div>
          </div>
        )}

        <button className="btn btn-primary btn-block" onClick={exchange} disabled={loading || !canExchange} style={{ padding: '14px', fontSize: '1rem', opacity: canExchange ? 1 : 0.5 }}>
          {loading ? 'Exchanging…' : 'Exchange'}
        </button>
      </div>
    </div>
  );
}
