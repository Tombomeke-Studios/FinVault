import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../components/Icon';
import { money, PageHead } from '../components/UI';

interface Mandate { id: string; payeeEmail: string; amount: number; currency: string; description: string; intervalDays: number; status: string; nextChargeAt: string; totalCharged: number; chargeCount: number; }
interface Props { compact: boolean; token: string; navigate: (r: string) => void; fire: (t: string, b: string, type?: string) => void; }

export function ScreenMandates({ compact, token, navigate, fire }: Props) {
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const fetchMandates = useCallback(async () => {
    try { const res = await fetch('/api/invoices/mandates', { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setMandates(await res.json()); } catch {}
  }, [token]);
  useEffect(() => { fetchMandates(); }, [fetchMandates]);

  const cancel = async (id: string) => {
    if (!confirm('Cancel this direct debit?')) return;
    await fetch(`/api/invoices/mandates/${id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    fire('Cancelled', 'Mandate cancelled.', 'success'); fetchMandates();
  };

  const intervalLabel = (d: number) => d <= 1 ? 'Daily' : d === 7 ? 'Weekly' : d === 30 ? 'Monthly' : d === 365 ? 'Yearly' : `Every ${d}d`;

  return (
    <div style={{ padding: compact ? 16 : 24, maxWidth: 720, margin: '0 auto' }}>
      <PageHead title="Direct Debits" back={() => navigate('settings')} />
      {mandates.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
          <Icon name="repeat" size={32} /><div style={{ marginTop: 8 }}>No active direct debits</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mandates.map(m => (
            <div key={m.id} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{m.description || m.payeeEmail}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>{intervalLabel(m.intervalDays)} · {m.chargeCount} charges</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: m.status === 'active' ? 'var(--accent)' : 'var(--text-3)', marginTop: 4 }}>{m.status.toUpperCase()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{money(m.amount)}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>Total: {money(m.totalCharged)}</div>
                {m.status === 'active' && <button className="btn btn--ghost" style={{ color: '#fb7185', fontSize: '0.75rem', marginTop: 4 }} onClick={() => cancel(m.id)}>Cancel</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
