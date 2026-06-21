import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../components/Icon';
import { money, Sheet, PageHead } from '../components/UI';

interface Dispute { id: string; transactionId: string; reason: string; status: string; resolution?: string | null; createdAt: string; }
interface Transaction { id: string; reference?: string; amount: number; description: string; createdAt: string; }
interface Props { compact: boolean; token: string; transactions: Transaction[]; navigate: (r: string) => void; fire: (t: string, b: string, type?: string) => void; }

const STATUS_META: Record<string, { color: string; icon: string; label: string }> = {
  open:          { color: 'var(--accent)', icon: 'clock',          label: 'Under Review' },
  investigating: { color: '#fbbf24',       icon: 'search',         label: 'Investigating' },
  resolved:      { color: '#34d399',       icon: 'check',          label: 'Resolved' },
  rejected:      { color: '#fb7185',       icon: 'x',              label: 'Rejected' },
};

export function ScreenDisputes({ compact, token, transactions, navigate, fire }: Props) {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchDisputes = useCallback(async () => {
    try { const res = await fetch('/api/disputes', { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setDisputes(await res.json()); } catch {}
  }, [token]);
  useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

  const submit = async () => {
    if (!selectedTxId || !reason) return;
    setLoading(true);
    try {
      const res = await fetch('/api/disputes', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ transactionId: selectedTxId, reason }) });
      if (res.ok) { fire('Filed', 'Dispute submitted for review.', 'success'); setReportOpen(false); setSelectedTxId(''); setReason(''); fetchDisputes(); }
      else { const e = await res.json(); fire('Error', e.error || 'Failed.', 'error'); }
    } catch { fire('Error', 'Failed.', 'error'); }
    setLoading(false);
  };

  return (
    <div style={{ padding: compact ? 16 : 24, maxWidth: 760, margin: '0 auto' }}>
      <PageHead title="Disputes" back={compact ? () => navigate('overview') : undefined} />
      <button className="btn" style={{ marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setReportOpen(true)}>
        <Icon name="alert-triangle" size={16} /> Report transaction
      </button>

      {disputes.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 'var(--r)', background: 'var(--surface-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Icon name="shield" size={26} />
          </div>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-2)', marginBottom: 4 }}>No disputes</div>
          <div style={{ fontSize: '0.84rem' }}>All your transactions look good. Report any suspicious activity here.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {disputes.map(d => {
            const meta = STATUS_META[d.status] || STATUS_META.open;
            return (
              <div key={d.id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 'var(--r)', background: `color-mix(in oklab, ${meta.color} 15%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <Icon name={meta.icon} size={20} style={{ color: meta.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{d.reason}</div>
                  <div style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: 3 }}>Transaction {d.transactionId.slice(0, 8)}…</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color }} />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: meta.color, letterSpacing: '0.05em' }}>{meta.label.toUpperCase()}</span>
                  </div>
                  {d.resolution && <div style={{ color: 'var(--text-2)', fontSize: '0.82rem', marginTop: 6, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)' }}>{d.resolution}</div>}
                </div>
                <span style={{ color: 'var(--text-3)', fontSize: '0.78rem', flexShrink: 0 }}>{new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={reportOpen} onClose={() => setReportOpen(false)} title="Report Transaction">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="eyebrow">Select the transaction to dispute</div>
          <div style={{ maxHeight: 220, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {transactions.slice(0, 20).map(tx => (
              <div key={tx.id} className="card" style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, borderColor: selectedTxId === tx.id ? 'var(--accent)' : 'var(--line)', boxShadow: selectedTxId === tx.id ? '0 0 0 1px var(--accent)' : 'none', transition: 'border-color 0.15s, box-shadow 0.15s' }} onClick={() => setSelectedTxId(tx.id)}>
                {selectedTxId === tx.id && <Icon name="check" size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
                <span style={{ fontSize: '0.88rem', flex: 1 }}>{tx.description}</span>
                <span className="num" style={{ fontWeight: 600, fontSize: '0.88rem', flexShrink: 0 }}>{money(tx.amount)}</span>
              </div>
            ))}
          </div>
          <textarea className="field" placeholder="Describe the issue — what happened and when" value={reason} onChange={e => setReason(e.target.value)} rows={3} style={{ resize: 'vertical' }} />
          <button className="btn" onClick={submit} disabled={loading || !selectedTxId || !reason} style={{ opacity: (!selectedTxId || !reason) ? 0.5 : 1 }}>
            {loading ? 'Submitting…' : 'File Dispute'}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
