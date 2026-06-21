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
    if (!confirm('Cancel this direct debit mandate?')) return;
    await fetch(`/api/invoices/mandates/${id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    fire('Cancelled', 'Mandate cancelled.', 'success'); fetchMandates();
  };

  const intervalLabel = (d: number) => d <= 1 ? 'Daily' : d === 7 ? 'Weekly' : d === 30 ? 'Monthly' : d === 365 ? 'Yearly' : `Every ${d}d`;

  return (
    <div style={{ padding: compact ? 16 : 24, maxWidth: 760, margin: '0 auto' }}>
      <PageHead title="Direct Debits" back={compact ? () => navigate('overview') : undefined} />

      {mandates.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 'var(--r)', background: 'var(--surface-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Icon name="repeat" size={26} />
          </div>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-2)', marginBottom: 4 }}>No active direct debits</div>
          <div style={{ fontSize: '0.84rem' }}>SEPA mandates from merchants will appear here</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mandates.map(m => (
            <div key={m.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 'var(--r)', background: m.status === 'active' ? 'color-mix(in oklab, var(--accent) 15%, transparent)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="repeat" size={20} style={{ color: m.status === 'active' ? 'var(--accent)' : 'var(--text-3)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{m.description || m.payeeEmail}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: 2 }}>{intervalLabel(m.intervalDays)} · {m.chargeCount} charges · Next: {new Date(m.nextChargeAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: m.status === 'active' ? 'var(--accent)' : 'var(--text-3)', marginTop: 6, letterSpacing: '0.05em' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.status === 'active' ? 'var(--accent)' : 'var(--text-3)' }} />
                  {m.status.toUpperCase()}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="num" style={{ fontWeight: 700, fontSize: '1.1rem' }}>{money(m.amount)}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '0.78rem', marginTop: 2 }}>Total: <span className="num">{money(m.totalCharged)}</span></div>
                {m.status === 'active' && <button className="btn btn-ghost" style={{ color: '#fb7185', fontSize: '0.75rem', marginTop: 6, padding: '4px 8px' }} onClick={() => cancel(m.id)}>Cancel</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
