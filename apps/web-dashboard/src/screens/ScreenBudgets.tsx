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
    <div style={{ padding: compact ? 16 : 24, maxWidth: 720, margin: '0 auto' }}>
      <PageHead title="Budgets" back={() => navigate('settings')} />
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
              <div key={b.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>{b.category}</span>
                  <button className="btn btn--ghost" style={{ padding: 4 }} onClick={() => remove(b.id)}><Icon name="trash-2" size={14} /></button>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct * 100}%`, borderRadius: 3, background: over ? '#fb7185' : 'var(--accent)', transition: 'width 0.4s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.8rem' }}>
                  <span style={{ color: over ? '#fb7185' : 'var(--text-3)' }}>{money(b.currentSpend)} spent</span>
                  <span style={{ color: 'var(--text-3)' }}>{money(b.monthlyLimit)} limit</span>
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
              <button key={c} className={`chip ${category === c ? 'chip--active' : ''}`} onClick={() => setCategory(c)}>{c}</button>
            ))}
          </div>
          <input className="field" placeholder="Monthly limit" value={limit} onChange={e => setLimit(e.target.value)} type="number" min="0" step="0.01" />
          <button className="btn" onClick={create} disabled={loading}>{loading ? 'Saving...' : 'Set Budget'}</button>
        </div>
      </Sheet>
    </div>
  );
}
