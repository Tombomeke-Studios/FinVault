import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../components/Icon';
import { money, Sheet, PageHead } from '../components/UI';

interface Budget { id: string; category: string; monthlyLimit: number; currentSpend: number; alertThreshold: number; month: string; }
interface Props { compact: boolean; token: string; navigate: (r: string) => void; fire: (t: string, b: string, type?: string) => void; }

const CATEGORIES = ['Groceries', 'Dining', 'Transport', 'Shopping', 'Entertainment', 'Bills', 'Health', 'Other'];

export function ScreenBudgets({ compact, token, navigate, fire }: Props) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [category, setCategory] = useState('Groceries');
  const [limit, setLimit] = useState('');
  const [loading, setLoading] = useState(false);
  const currentMonth = new Date().toISOString().slice(0, 7);

  const fetchBudgets = useCallback(async () => {
    try { const res = await fetch(`/api/budgets?month=${currentMonth}`, { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setBudgets(await res.json()); } catch {}
  }, [token, currentMonth]);
  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);

  const create = async () => {
    const val = parseFloat(limit);
    if (!val || val <= 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ category, monthlyLimit: val, month: currentMonth }) });
      if (res.ok) { fire('Budget set', `${category}: ${money(val)}/month`, 'success'); setCreateOpen(false); setLimit(''); fetchBudgets(); }
    } catch { fire('Error', 'Failed.', 'error'); }
    setLoading(false);
  };

  const remove = async (id: string) => {
    await fetch(`/api/budgets/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fire('Removed', 'Budget removed.', 'success'); fetchBudgets();
  };

  return (
    <div style={{ padding: compact ? 16 : 24, maxWidth: 760, margin: '0 auto' }}>
      <PageHead title="Budgets" back={compact ? () => navigate('overview') : undefined} />
      <div style={{ color: 'var(--text-3)', fontSize: '0.85rem', marginBottom: 16 }}>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
      <button className="btn" style={{ marginBottom: 16 }} onClick={() => setCreateOpen(true)}><Icon name="plus" size={16} /> Set Budget</button>
      {budgets.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
          <Icon name="bar-chart-2" size={32} /><div style={{ marginTop: 8 }}>No budgets set</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {budgets.map(b => {
            const pct = b.monthlyLimit > 0 ? Math.min(b.currentSpend / b.monthlyLimit, 1) : 0;
            const over = b.currentSpend > b.monthlyLimit;
            return (
              <div key={b.id} className="card" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 'var(--r)', background: over ? '#fb71851A' : 'color-mix(in oklab, var(--accent) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name="bar-chart-2" size={18} style={{ color: over ? '#fb7185' : 'var(--accent)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{b.category}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', marginTop: 2 }}>{Math.round(pct * 100)}% used</div>
                  </div>
                  <button className="btn btn-ghost" style={{ padding: 6, color: 'var(--text-3)' }} onClick={() => remove(b.id)}><Icon name="trash-2" size={15} /></button>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct * 100}%`, borderRadius: 4, background: over ? '#fb7185' : 'var(--accent)', transition: 'width 0.5s cubic-bezier(.22,.9,.3,1)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.82rem' }}>
                  <span className="num" style={{ fontWeight: 600, color: over ? '#fb7185' : 'var(--text-2)' }}>{money(b.currentSpend)} spent</span>
                  <span className="num" style={{ color: 'var(--text-3)' }}>{money(b.monthlyLimit)} limit</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Sheet open={createOpen} onClose={() => setCreateOpen(false)} title="Set Budget">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(c => (
              <button key={c} className={`chip ${category === c ? 'chip-accent' : ''}`} onClick={() => setCategory(c)}>{c}</button>
            ))}
          </div>
          <input className="field" placeholder="Monthly limit" value={limit} onChange={e => setLimit(e.target.value)} type="number" min="0" step="0.01" />
          <button className="btn" onClick={create} disabled={loading}>{loading ? 'Saving...' : 'Set Budget'}</button>
        </div>
      </Sheet>
    </div>
  );
}
