import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../components/Icon';
import { money, PageHead } from '../components/UI';

interface Receipt { id: string; transactionRef: string; payerEmail: string; payeeEmail?: string; amount: number; currency: string; description: string; createdAt: string; }
interface PaymentRequest { id: string; creatorEmail: string; recipientEmail: string; amount: number; currency: string; description: string; status: string; createdAt: string; }
interface Props { compact: boolean; token: string; navigate: (r: string) => void; fire: (t: string, b: string, type?: string) => void; }

const STATUS_META: Record<string, { color: string; label: string }> = {
  paid:     { color: '#34d399', label: 'Paid' },
  pending:  { color: 'var(--accent)', label: 'Pending' },
  declined: { color: '#fb7185', label: 'Declined' },
  expired:  { color: 'var(--text-3)', label: 'Expired' },
};

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

  const emptyState = (icon: string, title: string, sub: string) => (
    <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
      <div style={{ width: 56, height: 56, borderRadius: 'var(--r)', background: 'var(--surface-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <Icon name={icon} size={26} />
      </div>
      <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-2)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: '0.84rem' }}>{sub}</div>
    </div>
  );

  return (
    <div style={{ padding: compact ? 16 : 24, maxWidth: 760, margin: '0 auto' }}>
      <PageHead title="Invoices & Receipts" back={compact ? () => navigate('overview') : undefined} />

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 4 }}>
        {(['receipts', 'requests'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '9px 16px', borderRadius: 'calc(var(--r) - 3px)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', transition: 'all 0.2s',
            background: tab === t ? 'var(--accent)' : 'transparent',
            color: tab === t ? 'var(--on-accent)' : 'var(--text-3)',
            boxShadow: tab === t ? '0 2px 8px color-mix(in oklab, var(--accent) 35%, transparent)' : 'none',
          }}>
            {t === 'receipts' ? 'Receipts' : 'Payment Requests'}
          </button>
        ))}
      </div>

      {tab === 'receipts' ? (
        receipts.length === 0 ? emptyState('file-text', 'No receipts yet', 'Transaction receipts will appear here after payments') :
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {receipts.map(r => (
            <div key={r.id} className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', background: 'color-mix(in oklab, var(--accent) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="file-text" size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{r.description}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '0.78rem', marginTop: 2 }}>Ref: {r.transactionRef} · {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
              <div className="num" style={{ fontWeight: 700, fontSize: '1.05rem', flexShrink: 0 }}>{money(r.amount, r.currency)}</div>
            </div>
          ))}
        </div>
      ) : (
        requests.length === 0 ? emptyState('inbox', 'No payment requests', 'Requests you send or receive will appear here') :
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {requests.map(r => {
            const meta = STATUS_META[r.status] || STATUS_META.pending;
            return (
              <div key={r.id} className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', background: `color-mix(in oklab, ${meta.color} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="inbox" size={16} style={{ color: meta.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{r.description}</div>
                  <div style={{ color: 'var(--text-3)', fontSize: '0.78rem', marginTop: 2 }}>From: {r.creatorEmail}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: meta.color, marginTop: 6, letterSpacing: '0.05em' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color }} />
                    {meta.label.toUpperCase()}
                  </div>
                </div>
                <div className="num" style={{ fontWeight: 700, fontSize: '1.05rem', flexShrink: 0 }}>{money(r.amount, r.currency)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
