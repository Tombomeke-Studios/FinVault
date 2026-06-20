import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../components/Icon';
import { money, PageHead } from '../components/UI';

interface Receipt { id: string; transactionRef: string; payerEmail: string; payeeEmail?: string; amount: number; currency: string; description: string; createdAt: string; }
interface PaymentRequest { id: string; creatorEmail: string; recipientEmail: string; amount: number; currency: string; description: string; status: string; createdAt: string; }
interface Props { compact: boolean; token: string; navigate: (r: string) => void; fire: (t: string, b: string, type?: string) => void; }

export function ScreenInvoices({ compact, token, navigate, fire }: Props) {
  const [tab, setTab] = useState<'receipts' | 'requests'>('receipts');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [rr, pr] = await Promise.all([
        fetch('/api/invoices/receipts', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/invoices/payment-requests', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (rr.ok) setReceipts(await rr.json());
      if (pr.ok) setRequests(await pr.json());
    } catch {}
  }, [token]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const statusColor = (s: string) => s === 'paid' ? '#34d399' : s === 'pending' ? 'var(--accent)' : '#fb7185';

  return (
    <div style={{ padding: compact ? 16 : 24, maxWidth: 720, margin: '0 auto' }}>
      <PageHead title="Invoices & Receipts" back={() => navigate('settings')} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`chip ${tab === 'receipts' ? 'chip--active' : ''}`} onClick={() => setTab('receipts')}>Receipts</button>
        <button className={`chip ${tab === 'requests' ? 'chip--active' : ''}`} onClick={() => setTab('requests')}>Payment Requests</button>
      </div>
      {tab === 'receipts' ? (
        receipts.length === 0 ? <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}><Icon name="file-text" size={32} /><div style={{ marginTop: 8 }}>No receipts</div></div> :
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {receipts.map(r => (
            <div key={r.id} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{r.description}</div><div style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>Ref: {r.transactionRef} · {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div></div>
              <div style={{ fontWeight: 700 }}>{money(r.amount, r.currency)}</div>
            </div>
          ))}
        </div>
      ) : (
        requests.length === 0 ? <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}><Icon name="inbox" size={32} /><div style={{ marginTop: 8 }}>No payment requests</div></div> :
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {requests.map(r => (
            <div key={r.id} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{r.description}</div><div style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>From: {r.creatorEmail}</div><div style={{ fontSize: '0.72rem', fontWeight: 700, color: statusColor(r.status), marginTop: 4 }}>{r.status.toUpperCase()}</div></div>
              <div style={{ fontWeight: 700 }}>{money(r.amount, r.currency)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
