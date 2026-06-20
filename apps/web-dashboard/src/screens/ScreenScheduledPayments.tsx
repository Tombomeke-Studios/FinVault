import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../components/Icon';
import { money, Sheet, PageHead } from '../components/UI';

interface ScheduledPayment {
  id: string; sourceWalletId: string; targetEmail?: string | null; targetIban?: string | null;
  targetName: string; amount: number; currency: string; description: string;
  frequency: string; nextRunAt: string; status: string;
}

interface Props {
  compact: boolean; token: string; navigate: (r: string) => void;
  wallets: { id: string; type: string }[];
  fire: (t: string, b: string, type?: string) => void;
}

export function ScreenScheduledPayments({ compact, token, navigate, wallets, fire }: Props) {
  const [payments, setPayments] = useState<ScheduledPayment[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [target, setTarget] = useState(''); const [targetName, setTargetName] = useState('');
  const [amt, setAmt] = useState(''); const [desc, setDesc] = useState('');
  const [frequency, setFrequency] = useState('monthly'); const [loading, setLoading] = useState(false);

  const fetchPayments = useCallback(async () => {
    try {
      const res = await fetch('/api/scheduled-payments', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setPayments(await res.json());
    } catch { /* offline */ }
  }, [token]);
  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const create = async () => {
    const val = parseFloat(amt);
    if (!target || !val || val <= 0) return;
    setLoading(true);
    try {
      const isIban = /^[A-Z]{2}\d{2}/.test(target.replace(/\s/g, '').toUpperCase());
      const body: any = {
        sourceWalletId: wallets.find(w => w.type === 'checking')?.id || wallets[0]?.id,
        amount: val, description: desc || 'Scheduled payment', frequency,
        nextRunAt: new Date(Date.now() + 86400000).toISOString(), targetName,
      };
      if (isIban) body.targetIban = target.replace(/\s/g, '').toUpperCase();
      else body.targetEmail = target.trim().toLowerCase();
      const res = await fetch('/api/scheduled-payments', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) { fire('Scheduled', `Payment of ${money(val)} scheduled ${frequency}.`, 'success'); setCreateOpen(false); setTarget(''); setTargetName(''); setAmt(''); setDesc(''); fetchPayments(); }
    } catch { fire('Error', 'Failed to create.', 'error'); }
    setLoading(false);
  };

  const cancel = async (id: string) => {
    await fetch(`/api/scheduled-payments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: 'completed' }) });
    fire('Cancelled', 'Scheduled payment cancelled.', 'success');
    fetchPayments();
  };

  const freqLabel = (f: string) => f === 'once' ? 'One-time' : f.charAt(0).toUpperCase() + f.slice(1);

  return (
    <div style={{ padding: compact ? 16 : 24, maxWidth: 720, margin: '0 auto' }}>
      <PageHead title="Scheduled Payments" back={() => navigate('settings')} />
      <button className="btn" style={{ marginBottom: 16 }} onClick={() => setCreateOpen(true)}>
        <Icon name="plus" size={16} /> New
      </button>
      {payments.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
          <Icon name="calendar" size={32} /><div style={{ marginTop: 8 }}>No scheduled payments yet</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {payments.map(p => (
            <div key={p.id} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{p.targetName || p.targetEmail || p.targetIban}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>{freqLabel(p.frequency)} · {p.description}</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: p.status === 'active' ? 'var(--accent)' : 'var(--text-3)', marginTop: 4 }}>{p.status.toUpperCase()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{money(p.amount)}</div>
                {p.status === 'active' && <button className="btn btn--ghost" style={{ fontSize: '0.75rem', color: '#fb7185', marginTop: 4 }} onClick={() => cancel(p.id)}>Cancel</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Sheet open={createOpen} onClose={() => setCreateOpen(false)} title="New Scheduled Payment">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input className="field" placeholder="Recipient (email or IBAN)" value={target} onChange={e => setTarget(e.target.value)} />
          <input className="field" placeholder="Recipient name (optional)" value={targetName} onChange={e => setTargetName(e.target.value)} />
          <input className="field" placeholder="Amount" value={amt} onChange={e => setAmt(e.target.value)} type="number" min="0" step="0.01" />
          <input className="field" placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            {['once', 'daily', 'weekly', 'monthly'].map(f => (
              <button key={f} className={`chip ${frequency === f ? 'chip--active' : ''}`} onClick={() => setFrequency(f)}>{freqLabel(f)}</button>
            ))}
          </div>
          <button className="btn" onClick={create} disabled={loading}>{loading ? 'Creating...' : 'Schedule Payment'}</button>
        </div>
      </Sheet>
    </div>
  );
}
