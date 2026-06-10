import React, { useState, useMemo } from 'react';
import { Icon } from '../components/Icon';
import { money, Donut, Bars, catColor, Delta, Segmented, CategoryIcon, PageHead } from '../components/UI';
import type { AppData } from '../App';

export function ScreenAnalytics({ compact, data }: { compact: boolean; data: AppData }) {
  const [range, setRange] = useState('Month');
  const [budget, setBudget] = useState(2000);
  const [budgetEditing, setBudgetEditing] = useState(false);
  const [budgetInput, setBudgetInput] = useState('2000');
  const cats = [...data.spendByCat].sort((a, b) => b.amount - a.amount);
  const total = cats.reduce((s, c) => s + c.amount, 0);
  const totalSaved = data.goals.reduce((s, g) => s + g.saved, 0);

  // Dynamic deltas from monthly cashflow history
  const prevMonth = data.monthly[data.monthly.length - 2] || { in: 0, out: 0 };
  const spentDelta = prevMonth.out > 0 ? parseFloat(((total - prevMonth.out) / prevMonth.out * 100).toFixed(1)) : 0;
  const daysElapsed = new Date().getDate();
  const avgDay = daysElapsed > 0 ? total / daysElapsed : 0;
  const prevAvgDay = prevMonth.out > 0 ? prevMonth.out / 30 : 0;
  const avgDayDelta = prevAvgDay > 0 ? parseFloat(((avgDay - prevAvgDay) / prevAvgDay * 100).toFixed(1)) : 0;
  const totalTarget = data.goals.reduce((s, g) => s + g.target, 0);
  const savedDelta = totalTarget > 0 ? parseFloat(((totalSaved / totalTarget) * 100).toFixed(1)) : 0;

  // Dynamically calculate top merchants from actual transactions
  const topMerchants = useMemo(() => {
    const myWalletIds = new Set(data.wallets.map(w => w.id));
    const merchantSums: Record<string, { name: string; cat: string; amount: number }> = {};

    data.transactions.forEach(t => {
      const isOutgoing = t.senderWalletId && myWalletIds.has(t.senderWalletId);
      if (isOutgoing) {
        const desc = t.description || 'Other';
        let merchant = desc;
        let cat = 'other';
        const lowerDesc = desc.toLowerCase();
        
        if (lowerDesc.includes('albert') || lowerDesc.includes('ah') || lowerDesc.includes('heijn')) {
          merchant = 'Albert Heijn';
          cat = 'groceries';
        } else if (lowerDesc.includes('uber') || lowerDesc.includes('taxi') || lowerDesc.includes('transport')) {
          merchant = 'Uber';
          cat = 'transport';
        } else if (lowerDesc.includes('spotify') || lowerDesc.includes('netflix') || lowerDesc.includes('youtube') || lowerDesc.includes('premium') || lowerDesc.includes('subs')) {
          merchant = desc;
          cat = 'subs';
        } else if (lowerDesc.includes('brussels') || lowerDesc.includes('airline') || lowerDesc.includes('flight') || lowerDesc.includes('travel')) {
          merchant = 'Brussels Airlines';
          cat = 'travel';
        } else if (lowerDesc.includes('amazon') || lowerDesc.includes('bol.com') || lowerDesc.includes('bol') || lowerDesc.includes('shopping')) {
          merchant = desc;
          cat = 'shopping';
        } else if (lowerDesc.includes('invoice') || lowerDesc.includes('bill') || lowerDesc.includes('tax') || lowerDesc.includes('utilities')) {
          merchant = desc;
          cat = 'bills';
        }

        if (!merchantSums[merchant]) {
          merchantSums[merchant] = { name: merchant, cat, amount: 0 };
        }
        merchantSums[merchant].amount += typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount)) || 0;
      }
    });

    const sorted = Object.values(merchantSums).sort((a, b) => b.amount - a.amount).slice(0, 3);
    
    // Fallback if no transactions
    if (sorted.length === 0) {
      return [
        { name: 'Albert Heijn', cat: 'groceries', amount: 142.31 },
        { name: 'Brussels Airlines', cat: 'travel', amount: 214.00 },
        { name: 'Bol.com', cat: 'shopping', amount: 144.98 }
      ];
    }
    return sorted;
  }, [data.transactions, data.wallets]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
      <PageHead title="Insights" subtitle="Where your money goes." action={
        <Segmented value={range} options={['Week', 'Month', 'Year']} onChange={setRange} />
      } />

      {/* stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 'var(--gap)' }}>
        {[
          { l: 'Total spent',  v: money(total),                                        d: spentDelta,   icon: 'trend'   },
          { l: 'vs budget',    v: `${Math.round((total / budget) * 100)}%`,            sub: `of ${money(budget).replace('.00','')}`, icon: 'target' },
          { l: 'Avg / day',    v: money(avgDay).replace('.00', '.0'),                  d: avgDayDelta,  icon: 'clock'   },
          { l: 'Saved',        v: money(totalSaved),                                   sub: `${savedDelta}% of goals`,              icon: 'flame'   },
        ].map(s => (
          <div key={s.l} className="card" style={{ padding: 'var(--pad)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="eyebrow">{s.l}</span>
              <Icon name={s.icon} size={16} style={{ color: 'var(--text-3)' }} />
            </div>
            <div className="num display" style={{ fontSize: '1.6rem', fontWeight: 700, marginTop: 8 }}>{s.v}</div>
            <div style={{ marginTop: 2 }}>{s.d !== undefined ? <Delta value={s.d} /> : <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>{s.sub}</span>}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1.3fr', gap: 'var(--gap-lg)', alignItems: 'start' }}>
        {/* donut */}
        <div className="card" style={{ padding: 'var(--pad-lg)' }}>
          <h2 className="display" style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--gap)' }}>By category</h2>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--gap-lg)' }}>
            <Donut size={186} thickness={26} segments={cats.map(c => ({ value: c.amount, color: catColor(c.hue) }))}>
              <div className="num display" style={{ fontSize: '1.7rem', fontWeight: 700 }}>{money(total).replace('.00', '')}</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-3)' }}>this {range.toLowerCase()}</div>
            </Donut>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {cats.map(c => {
                const pct = Math.round((c.amount / total) * 100);
                return (
                  <div key={c.cat}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, fontSize: '0.86rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: catColor(c.hue) }} />
                      <span style={{ flex: 1, fontWeight: 600 }}>{c.label}</span>
                      <span className="num" style={{ color: 'var(--text-2)' }}>{money(c.amount).replace('.00', '')}</span>
                      <span className="num" style={{ color: 'var(--text-3)', width: 34, textAlign: 'right' }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: catColor(c.hue), transition: 'width .6s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
          {/* cashflow bars */}
          <div className="card" style={{ padding: 'var(--pad-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--gap)' }}>
              <h2 className="display" style={{ fontSize: '1.1rem', fontWeight: 700 }}>Cash flow</h2>
              <div style={{ display: 'flex', gap: 14, fontSize: '0.78rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--accent)' }} /> In</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--surface-hi)' }} /> Out</span>
              </div>
            </div>
            <Bars data={data.monthly} h={compact ? 130 : 168} />
          </div>

          {/* budget */}
          <div className="card" style={{ padding: 'var(--pad-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <h2 className="display" style={{ fontSize: '1.1rem', fontWeight: 700 }}>Monthly budget</h2>
              {budgetEditing ? (
                <form onSubmit={e => { e.preventDefault(); const v = parseFloat(budgetInput); if (v > 0) setBudget(v); setBudgetEditing(false); }} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input autoFocus className="field num" value={budgetInput} onChange={e => setBudgetInput(e.target.value.replace(/[^0-9.]/g, ''))} style={{ width: 100, padding: '4px 8px', fontSize: '0.88rem' }} />
                  <button type="submit" className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.82rem' }}>Save</button>
                </form>
              ) : (
                <button className="btn btn-quiet" style={{ fontSize: '0.84rem', color: 'var(--text-2)', padding: '4px 8px' }} onClick={() => { setBudgetInput(String(budget)); setBudgetEditing(true); }}>
                  {money(total).replace('.00','')} / {money(budget).replace('.00','')} <Icon name="edit" size={13} style={{ marginLeft: 4 }} />
                </button>
              )}
            </div>
            <div style={{ height: 14, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden', position: 'relative' }}>
              <div style={{ width: `${Math.min(100, (total / budget) * 100)}%`, height: '100%', borderRadius: 99, background: total > budget ? 'var(--neg)' : 'linear-gradient(90deg, var(--accent), var(--accent-hi))', transition: 'width .6s ease' }} />
            </div>
            <p style={{ marginTop: 12, color: 'var(--text-2)', fontSize: '0.9rem' }}>
              {total > budget
                ? <><strong style={{ color: 'var(--neg)' }}>{money(total - budget).replace('.00','')} over budget</strong> this month.</>
                : <>You're <strong style={{ color: 'var(--pos)' }}>{money(budget - total).replace('.00','')} under budget</strong> with {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()} days left.</>
              }
            </p>
          </div>

          {/* top merchants */}
          <div className="card" style={{ padding: 'var(--pad)' }}>
            <h2 className="display" style={{ fontSize: '1rem', fontWeight: 700, padding: '4px 6px 8px' }}>Top merchants</h2>
            {topMerchants.map((m) => (
              <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 6px', borderTop: '1px solid var(--line)' }}>
                <CategoryIcon cat={m.cat} size={36} />
                <span style={{ flex: 1, fontWeight: 600, fontSize: '0.9rem' }}>{m.name}</span>
                <span className="num" style={{ fontWeight: 700 }}>{money(m.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
