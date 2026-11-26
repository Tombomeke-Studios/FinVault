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
    <div style={{ padding: compact ? 16 : 24, maxWidth: 760, margin: '0 auto' }}>
      <PageHead title="Scheduled Payments" back={compact ? () => navigate('overview') : undefined} />
      <button className="btn" style={{ marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setCreateOpen(true)}>
        <Icon name="plus" size={16} /> New payment
      </button>
      {payments.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 'var(--r)', background: 'var(--surface-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Icon name="calendar" size={26} />
          </div>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-2)', marginBottom: 4 }}>No scheduled payments</div>
          <div style={{ fontSize: '0.84rem' }}>Set up recurring transfers to automate your payments</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {payments.map(p => (
            <div key={p.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 'var(--r)', background: p.status === 'active' ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="calendar" size={20} style={{ color: p.status === 'active' ? 'var(--accent)' : 'var(--text-3)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{p.targetName || p.targetEmail || p.targetIban}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: 2 }}>{freqLabel(p.frequency)} · {p.description}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: p.status === 'active' ? 'var(--accent)' : 'var(--text-3)', marginTop: 6, letterSpacing: '0.05em' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.status === 'active' ? 'var(--accent)' : 'var(--text-3)' }} />
                  {p.status.toUpperCase()}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="num" style={{ fontWeight: 700, fontSize: '1.1rem' }}>{money(p.amount)}</div>
                {p.status === 'active' && <button className="btn btn-ghost" style={{ fontSize: '0.75rem', color: '#fb7185', marginTop: 6, padding: '4px 8px' }} onClick={() => cancel(p.id)}>Cancel</button>}
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
              <button key={f} className={`chip ${frequency === f ? 'chip-accent' : ''}`} onClick={() => setFrequency(f)}>{freqLabel(f)}</button>
            ))}
          </div>
          <button className="btn" onClick={create} disabled={loading}>{loading ? 'Creating...' : 'Schedule Payment'}</button>
        </div>
      </Sheet>
    </div>
  );
}
