import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../components/Icon';
import { money, Sheet, PageHead } from '../components/UI';

interface Dispute { id: string; transactionId: string; reason: string; status: string; resolution?: string | null; createdAt: string; }
interface Transaction { id: string; reference?: string; amount: number; description: string; createdAt: string; }
interface Props { compact: boolean; token: string; transactions: Transaction[]; navigate: (r: string) => void; fire: (t: string, b: string, type?: string) => void; }

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

  const statusColor = (s: string) => s === 'resolved' ? '#34d399' : s === 'investigating' ? 'var(--accent)' : s === 'rejected' ? '#fb7185' : 'var(--text-3)';

  return (
    <div style={{ padding: compact ? 16 : 24, maxWidth: 720, margin: '0 auto' }}>
      <PageHead title="Disputes" back={() => navigate('settings')} />
      <button className="btn" style={{ marginBottom: 16 }} onClick={() => setReportOpen(true)}><Icon name="plus" size={16} /> Report Transaction</button>
      {disputes.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}><Icon name="shield" size={32} /><div style={{ marginTop: 8 }}>No disputes filed</div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {disputes.map(d => (
            <div key={d.id} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{d.reason}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>TX: {d.transactionId.slice(0, 8)}...</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: statusColor(d.status), marginTop: 4 }}>{d.status.toUpperCase()}</div>
                {d.resolution && <div style={{ color: 'var(--text-3)', fontSize: '0.78rem', marginTop: 2 }}>Resolution: {d.resolution}</div>}
              </div>
              <div style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>{new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
            </div>
          ))}
        </div>
      )}
      <Sheet open={reportOpen} onClose={() => setReportOpen(false)} title="Report Transaction">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="eyebrow">Select transaction</div>
          <div style={{ maxHeight: 200, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {transactions.slice(0, 20).map(tx => (
              <div key={tx.id} className="card" style={{ padding: 10, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', border: selectedTxId === tx.id ? '2px solid var(--accent)' : '1px solid var(--line)' }} onClick={() => setSelectedTxId(tx.id)}>
                <span style={{ fontSize: '0.85rem' }}>{tx.description}</span>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{money(tx.amount)}</span>
              </div>
            ))}
          </div>
          <textarea className="field" placeholder="Reason for dispute" value={reason} onChange={e => setReason(e.target.value)} rows={3} />
          <button className="btn" onClick={submit} disabled={loading}>{loading ? 'Submitting...' : 'File Dispute'}</button>
        </div>
      </Sheet>
    </div>
  );
}
