import React, { useState } from 'react';
import { Icon } from '../components/Icon';
import { money, Ring, catColor, catSoft, PageHead, Sheet } from '../components/UI';

interface Goal { id: string; name: string; target: number; saved: number; hue: number; icon: string; due: string; }

interface SavingsProps {
  compact: boolean;
  fire: (t: string, b: string, type?: string) => void;
  goals: Goal[];
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
  wallets: any[];
  setWallets: React.Dispatch<React.SetStateAction<any[]>>;
  setTransactions: React.Dispatch<React.SetStateAction<any[]>>;
}

export function ScreenSavings({ compact, fire, goals, setGoals, wallets, setWallets, setTransactions }: SavingsProps) {
  const [add, setAdd] = useState<Goal | null>(null);
  const [addAmt, setAddAmt] = useState('');
  
  // New goal forms state
  const [newGoalOpen, setNewGoalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newIcon, setNewIcon] = useState('plane');
  const [newHue, setNewHue] = useState(12);

  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);
  const overallPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  const doAdd = () => {
    const v = parseFloat(addAmt || '0');
    if (v > 0 && add) {
      // 1. Deduct from active checking wallet (wallets[0])
      setWallets(prev => prev.map((w, idx) => idx === 0 ? { ...w, balance: Math.max(0, w.balance - v) } : w));
      
      // 2. Update goal saved amount
      setGoals(gs => gs.map(g => g.id === add.id ? { ...g, saved: Math.min(g.target, g.saved + v) } : g));
      
      // 3. Add to transaction history
      setTransactions(prev => [
        {
          id: 'tx-' + Date.now(),
          senderWalletId: wallets[0]?.id || 'mock-wallet-eur',
          receiverWalletId: null,
          amount: v,
          currency: 'EUR',
          status: 'confirmed',
          type: 'transfer',
          description: `Stashed to ${add.name}`,
          createdAt: new Date().toISOString(),
        },
        ...prev
      ]);

      fire('Added to ' + add.name, money(v) + ' moved from Everyday', 'success');
    }
    setAdd(null); setAddAmt('');
  };

  const handleCreateGoal = () => {
    const tgt = parseFloat(newTarget);
    if (!newName || !tgt) return;
    const newG = {
      id: 'g-' + Date.now(),
      name: newName,
      target: tgt,
      saved: 0,
      hue: newHue,
      icon: newIcon,
      due: 'No date',
    };
    setGoals(prev => [...prev, newG]);
    setNewGoalOpen(false);
    setNewName('');
    setNewTarget('');
    fire('Success', `Savings vault "${newName}" created successfully!`, 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
      <PageHead title="Goals" subtitle="Stash, automate and reach your targets." action={
        <button className="btn btn-primary" onClick={() => setNewGoalOpen(true)}>
          <Icon name="plus" size={17} /> {compact ? '' : 'New goal'}
        </button>
      } />

      {/* Summary */}
      {goals.length > 0 && (
        <div className="card rise" style={{ padding: 'var(--pad-lg)', background: 'linear-gradient(145deg, var(--accent-soft) 0%, transparent 65%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Ring pct={overallPct} size={88} thickness={10}>
              <div style={{ textAlign: 'center', lineHeight: 1 }}>
                <div className="num display" style={{ fontSize: '1.1rem', fontWeight: 800 }}>{overallPct}%</div>
              </div>
            </Ring>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="eyebrow">Total saved · {goals.length} goals</div>
              <div className="num display" style={{ fontSize: '1.85rem', fontWeight: 700, marginTop: 3, letterSpacing: '-0.03em' }}>{money(totalSaved)}</div>
              <div className="num" style={{ color: 'var(--text-2)', fontSize: '0.86rem' }}>of {money(totalTarget)} target</div>
            </div>
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="repeat" size={17} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', fontWeight: 600 }}>Auto-save active</div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>€250 / month — split across goals</div>
            </div>
            <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '0.82rem' }} onClick={() => fire('Auto-save', 'Adjust your rules in account settings.', 'info')}>Edit</button>
          </div>
        </div>
      )}

      {/* Goal cards */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--gap-lg)' }}>
        {goals.map(g => {
          const pct = Math.round((g.saved / g.target) * 100);
          const done = pct >= 100;
          return (
            <div key={g.id} className="card" style={{ padding: 'var(--pad-lg)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 44, height: 44, borderRadius: 'var(--r)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: catSoft(g.hue), color: catColor(g.hue) }}>
                  <Icon name={g.icon} size={21} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="display" style={{ fontWeight: 700, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                    <Icon name="clock" size={11} /> {g.due}
                  </div>
                </div>
                {done
                  ? <span className="chip" style={{ background: 'color-mix(in oklab, var(--pos) 14%, transparent)', color: 'var(--pos)', border: 'none', fontSize: '0.72rem', flexShrink: 0 }}>✓ Done</span>
                  : <span className="num" style={{ fontWeight: 800, fontSize: '1.05rem', color: catColor(g.hue), flexShrink: 0 }}>{pct}%</span>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span className="num display" style={{ fontSize: '1.35rem', fontWeight: 700 }}>{money(g.saved).replace('.00', '')}</span>
                <span className="num" style={{ color: 'var(--text-3)', fontSize: '0.84rem' }}>of {money(g.target).replace('.00', '')}</span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-2)' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${catColor(g.hue)}, color-mix(in oklab, ${catColor(g.hue)} 70%, white))`, transition: 'width .7s cubic-bezier(.22,.9,.3,1)' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-block" onClick={() => setAdd(g)} disabled={done} style={{ opacity: done ? 0.45 : 1, gap: 7, fontSize: '0.88rem' }}>
                  <Icon name="plus" size={16} /> Add money
                </button>
                <button className="btn btn-quiet" style={{ flexShrink: 0, padding: '0 12px' }} onClick={() => fire(g.name, `${pct}% reached — ${money(g.target - g.saved).replace('.00','')} remaining.`, 'info')}>
                  <Icon name="more" size={18} />
                </button>
              </div>
            </div>
          );
        })}
        {goals.length === 0 && (
          <div style={{ padding: 40, color: 'var(--text-3)', textAlign: 'center', width: '100%', gridColumn: '1 / -1' }}>No savings vaults created.</div>
        )}
      </div>

      {/* Add money sheet */}
      <Sheet open={!!add} onClose={() => { setAdd(null); setAddAmt(''); }} title={add ? 'Add to ' + add.name : ''} mobile={compact}>
        {add && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
            <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
              <div className="num display" style={{ fontSize: '2.8rem', fontWeight: 700, color: parseFloat(addAmt) > 0 ? 'var(--text)' : 'var(--text-3)' }}>
                €{addAmt || '0'}
              </div>
              <div style={{ color: 'var(--text-3)', fontSize: '0.84rem', marginTop: 4 }}>from Everyday</div>
            </div>
            <input className="field num" autoFocus value={addAmt} onChange={e => setAddAmt(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" style={{ textAlign: 'center', fontSize: '1.1rem' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              {[10, 25, 50, 100].map(v => (
                <button key={v} onClick={() => setAddAmt(String(v))} className="chip" style={{ flex: 1, justifyContent: 'center', cursor: 'pointer', padding: '9px 0' }}>€{v}</button>
              ))}
            </div>
            <button className="btn btn-primary btn-block" disabled={!(parseFloat(addAmt) > 0)} style={{ opacity: parseFloat(addAmt) > 0 ? 1 : 0.5 }} onClick={doAdd}>
              Move to goal
            </button>
          </div>
        )}
      </Sheet>

      {/* Create savings goal sheet */}
      <Sheet open={newGoalOpen} onClose={() => setNewGoalOpen(false)} title="Create a Savings Goal" mobile={compact}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
          <p style={{ color: 'var(--text-2)', fontSize: '0.92rem' }}>Set a new goal and start stashing funds.</p>
          <label className="label">Goal Name</label>
          <input className="field" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Dream House, Tesla" autoFocus />
          
          <label className="label">Target Amount (€)</label>
          <input className="field num" value={newTarget} onChange={e => setNewTarget(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0.00" />
          
          <label className="label">Icon</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {['plane', 'shield', 'laptop', 'car', 'heart'].map(ic => (
              <button key={ic} onClick={() => setNewIcon(ic)} className="chip" style={{ flex: 1, justifyContent: 'center', cursor: 'pointer', border: newIcon === ic ? '1.5px solid var(--accent)' : '1px solid var(--line)', background: newIcon === ic ? 'var(--accent-soft)' : 'var(--surface-2)', color: newIcon === ic ? 'var(--accent)' : 'var(--text-2)', padding: '8px 0' }}>
                <Icon name={ic} size={16} />
              </button>
            ))}
          </div>

          <label className="label">Color Design</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[12, 158, 230, 265, 320].map(h => (
              <button key={h} onClick={() => setNewHue(h)} className="chip" style={{ flex: 1, justifyContent: 'center', cursor: 'pointer', border: newHue === h ? '1.5px solid var(--accent)' : '1px solid var(--line)', background: newHue === h ? 'var(--accent-soft)' : 'var(--surface-2)', color: newHue === h ? 'var(--accent)' : 'var(--text-2)', padding: '8px 0', fontSize: 11 }}>
                Hue {h}
              </button>
            ))}
          </div>

          <button className="btn btn-primary btn-block" disabled={!newName || !parseFloat(newTarget)} onClick={handleCreateGoal} style={{ marginTop: 8 }}>
            Create Goal
          </button>
        </div>
      </Sheet>
    </div>
  );
}
