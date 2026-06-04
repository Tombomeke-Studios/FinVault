import React, { useState, useEffect, useRef } from 'react';

function useCountUp(target: number, duration = 1300) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) requestAnimationFrame(tick);
      else setVal(target);
    };
    requestAnimationFrame(tick);
  }, [target]);
  return val;
}
import { Icon } from '../components/Icon';
import { money, Sparkline, relTime, CategoryIcon, Ring, Donut, catColor, Delta } from '../components/UI';
import { BankCard } from '../components/BankCard';
import type { AppData } from '../App';

interface OverviewProps {
  compact: boolean;
  navigate: (r: string) => void;
  data: AppData;
  onTopup: () => void;
}

const QUICK_ACTIONS = [
  { icon: 'send',  label: 'Send',     route: 'transfer', primary: true },
  { icon: 'qr',   label: 'Request',  route: 'transfer' },
  { icon: 'plus', label: 'Top up',   route: '' },
  { icon: 'bolt', label: 'Pay bill', route: 'transfer' },
];

export function ScreenOverview({ compact, navigate, data, onTopup }: OverviewProps) {
  const [selCard, setSelCard] = useState(0);
  const { wallets, transactions, cards, goals, spendByCat, balanceTrend, monthly } = data;

  const totalEUR = wallets.filter(w => w.currency === 'EUR').reduce((s, w) => s + w.balance, 0);
  const animatedBalance = useCountUp(totalEUR);
  const [showBars, setShowBars] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShowBars(true), 200); return () => clearTimeout(t); }, []);
  const recent = transactions.slice(0, 6);
  const card = cards[Math.min(selCard, cards.length - 1)] ?? null;
  const goalsPreview = goals.slice(0, 3);
  const topCats = [...spendByCat].sort((a, b) => b.amount - a.amount).slice(0, 5);

  const currentMonthFlow = monthly[monthly.length - 1] || { in: 0, out: 0 };
  const prevBal = balanceTrend.length >= 2 ? balanceTrend[balanceTrend.length - 2] : balanceTrend[0] ?? 0;
  const currBal = balanceTrend[balanceTrend.length - 1] ?? totalEUR;
  const deltaBalance = prevBal > 0 ? parseFloat(((currBal - prevBal) / prevBal * 100).toFixed(1)) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>

      {/* ── Greeting ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="eyebrow">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 className="display" style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700, marginTop: 4 }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {data.user.firstName}
          </h1>
        </div>
        <span className="chip chip-accent"><Icon name="sparkle" size={13} /> {data.user.plan}</span>
      </div>

      {/* ── Hero row: balance + quick actions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr auto', gap: 'var(--gap-lg)', alignItems: 'stretch' }}>

        {/* Balance card */}
        <div className="card card-hero rise" style={{ padding: 'var(--pad-lg)', display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Total balance · EUR</div>
              <div className="num display" style={{ fontSize: 'clamp(2.8rem, 7vw, 4.2rem)', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em' }}>
                {money(animatedBalance)}
              </div>
              <div style={{ marginTop: 10 }}>
                <Delta value={deltaBalance} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: compact ? 'var(--gap-lg)' : 14, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
              {([['arrowDownLeft', currentMonthFlow.in, 'pos', 'This month in'] as const,
                 ['arrowUpRight',  currentMonthFlow.out, 'neg', 'This month out'] as const]).map(([icon, val, k, label]) => (
                <div key={k} className="stat-tile">
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--r)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in oklab, var(--${k}) 14%, transparent)`, color: `var(--${k})`, flexShrink: 0 }}>
                    <Icon name={icon} size={17} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: 3 }}>{label}</div>
                    <div className="num" style={{ fontWeight: 700, fontSize: '0.98rem', color: k === 'pos' ? 'var(--pos)' : 'var(--text)' }}>
                      {money(val, 'EUR', { signed: k === 'pos' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ margin: '20px -4px -4px', position: 'relative', zIndex: 1 }}>
            <Sparkline data={balanceTrend} h={compact ? 60 : 80} />
          </div>
        </div>

        {/* Quick actions */}
        {!compact && (
          <div className="card" style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 220 }}>
            <div className="eyebrow" style={{ marginBottom: 'var(--gap)' }}>Quick actions</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {QUICK_ACTIONS.map(a => (
                <button key={a.label} className="qaction" onClick={a.route ? () => navigate(a.route) : onTopup}>
                  <div className="qaction__icon" style={{ background: a.primary ? 'var(--accent)' : 'var(--surface-2)', color: a.primary ? 'var(--on-accent)' : 'var(--text)', border: a.primary ? 'none' : '1px solid var(--line)', boxShadow: a.primary ? '0 8px 22px -6px var(--accent-line)' : 'none' }}>
                    <Icon name={a.icon} size={21} />
                  </div>
                  <span className="qaction__label">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick actions strip on compact */}
      {compact && (
        <div className="card" style={{ padding: 'var(--pad)' }}>
          <div style={{ display: 'flex' }}>
            {QUICK_ACTIONS.map(a => (
              <button key={a.label} className="qaction" onClick={a.route ? () => navigate(a.route) : onTopup}>
                <div className="qaction__icon" style={{ background: a.primary ? 'var(--accent)' : 'var(--surface-2)', color: a.primary ? 'var(--on-accent)' : 'var(--text)', border: a.primary ? 'none' : '1px solid var(--line)', boxShadow: a.primary ? '0 8px 22px -6px var(--accent-line)' : 'none' }}>
                  <Icon name={a.icon} size={21} />
                </div>
                <span className="qaction__label">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Accounts strip ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 className="display" style={{ fontSize: '1.1rem', fontWeight: 700 }}>Accounts</h2>
        </div>
        <div style={{ display: 'flex', gap: 'var(--gap)', overflowX: 'auto', paddingBottom: 4 }} className="hide-scroll">
          {wallets.map((wl, i) => {
            return (
              <div key={wl.id} className={`card card-lift rise rise-d${i + 1}`} style={{
                minWidth: 220, flex: compact ? '0 0 auto' : 1, padding: 'var(--pad)',
                cursor: 'pointer', borderTop: `3px solid ${wl.currency === 'EUR' ? 'var(--accent)' : 'var(--warn)'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: '0.88rem' }}>
                    <Icon name={wl.type === 'savings' ? 'targetRing' : 'wallet'} size={16} style={{ color: 'var(--accent)' }} />
                    {wl.name || 'Account'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 700 }}>{wl.currency}</span>
                </div>
                <div className="num display" style={{ fontSize: '1.6rem', fontWeight: 700, margin: '10px 0 6px', letterSpacing: '-0.02em' }}>
                  {money(wl.balance, wl.currency)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="num" style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{wl.iban}</span>
                  {(wl.interestRate || 0) > 0 && (
                    <span className="chip chip-accent" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                      {((wl.interestRate || 0) * 100).toFixed(1)}% APY
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main content grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1.6fr 1fr', gap: 'var(--gap-lg)' }}>

        {/* Recent transactions */}
        <div className="card" style={{ padding: 'var(--pad)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--gap)', padding: '0 4px' }}>
            <h2 className="display" style={{ fontSize: '1.1rem', fontWeight: 700 }}>Recent activity</h2>
            <button onClick={() => navigate('transactions')} className="btn btn-quiet" style={{ padding: '5px 8px', fontSize: '0.82rem', color: 'var(--accent)' }}>
              See all <Icon name="chevRight" size={14} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recent.map((t, idx) => {
              const cat = t.type === 'deposit' ? 'deposit' : 'transfer';
              const amtNum = typeof t.amount === 'number' ? t.amount : parseFloat(t.amount);
              const isIncoming = t.receiverWalletId && wallets.some(w => w.id === t.receiverWalletId);
              const displayAmt = isIncoming ? amtNum : -amtNum;
              return (
                <div key={t.id} className={`tx-row rise rise-d${Math.min(idx + 1, 6)}`}>
                  <CategoryIcon cat={cat} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.description || 'Transaction'}
                    </div>
                    <div style={{ color: 'var(--text-3)', fontSize: '0.78rem', marginTop: 2 }}>{relTime(new Date(t.createdAt).getTime())}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="num" style={{ fontWeight: 700, fontSize: '0.98rem', color: displayAmt > 0 ? 'var(--pos)' : 'var(--text)' }}>
                      {money(displayAmt, t.currency || 'EUR', { signed: true })}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: 1, textTransform: 'capitalize' }}>{t.currency || 'EUR'}</div>
                  </div>
                </div>
              );
            })}
            {recent.length === 0 && (
              <div style={{ padding: '28px 8px', textAlign: 'center', color: 'var(--text-3)' }}>
                <Icon name="list" size={28} style={{ opacity: 0.4, marginBottom: 8, display: 'block', margin: '0 auto 10px' }} />
                No transactions yet
              </div>
            )}
          </div>
        </div>

        {/* Right column: card + spending */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>

          {/* Card preview */}
          {card && (
            <div className="card" style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="display" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                  {cards.length > 1 ? `Cards · ${cards.length}` : 'My card'}
                </h2>
                <button onClick={() => navigate('cards')} className="btn btn-quiet" style={{ padding: '4px 8px', fontSize: '0.8rem', color: 'var(--accent)' }}>
                  Manage <Icon name="chevRight" size={13} />
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <BankCard card={card} width={compact ? 300 : 260} onClick={() => navigate('cards')} />
              </div>
              {cards.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                  {cards.map((_, i) => (
                    <button key={i} onClick={() => setSelCard(i)} style={{
                      width: i === selCard ? 20 : 7, height: 7, borderRadius: 99, padding: 0, border: 'none',
                      background: i === selCard ? 'var(--accent)' : 'var(--surface-hi)',
                      cursor: 'pointer', transition: 'all .2s ease',
                    }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Spending breakdown */}
          {topCats.length > 0 && (
            <div className="card" style={{ padding: 'var(--pad)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 className="display" style={{ fontSize: '1.05rem', fontWeight: 700 }}>Spending</h2>
                <button onClick={() => navigate('analytics')} className="btn btn-quiet" style={{ padding: '4px 8px', fontSize: '0.8rem', color: 'var(--accent)' }}>
                  Insights <Icon name="chevRight" size={13} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <Donut size={110} thickness={18} segments={topCats.map(c => ({ value: c.amount, color: catColor(c.hue) }))}>
                  <div className="num display" style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                    {money(spendByCat.reduce((s, x) => s + x.amount, 0)).replace('.00', '')}
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-3)' }}>spent</div>
                </Donut>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {topCats.map(c => {
                    const pct = Math.round((c.amount / spendByCat.reduce((s, x) => s + x.amount, 0)) * 100);
                    return (
                      <div key={c.cat}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.8rem' }}>
                            <span style={{ width: 9, height: 9, borderRadius: 3, background: catColor(c.hue), flexShrink: 0 }} />
                            <span style={{ color: 'var(--text-2)' }}>{c.label}</span>
                          </div>
                          <span className="num" style={{ fontSize: '0.8rem', fontWeight: 700 }}>{money(c.amount).replace('.00', '')}</span>
                        </div>
                        <div style={{ height: 3, borderRadius: 99, background: 'var(--surface-hi)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${showBars ? pct : 0}%`, background: catColor(c.hue), borderRadius: 99, transition: 'width .8s cubic-bezier(.22,.9,.3,1)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Savings goals ── */}
      {goalsPreview.length > 0 && (
        <div className="card" style={{ padding: 'var(--pad)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--gap)', padding: '0 4px' }}>
            <h2 className="display" style={{ fontSize: '1.1rem', fontWeight: 700 }}>Savings goals</h2>
            <button onClick={() => navigate('savings')} className="btn btn-quiet" style={{ padding: '5px 8px', fontSize: '0.82rem', color: 'var(--accent)' }}>
              See all <Icon name="chevRight" size={14} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(3, 1fr)', gap: 'var(--gap)' }}>
            {goalsPreview.map((g, gi) => {
              const pct = Math.round((g.saved / g.target) * 100);
              return (
                <div key={g.id} className={`card card-lift scale-in rise-d${gi + 1}`} style={{ padding: 'var(--pad)', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Ring pct={pct} size={48} thickness={5} color={catColor(g.hue)}>
                      <Icon name={g.icon} size={16} style={{ color: catColor(g.hue) }} />
                    </Ring>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{g.name}</div>
                      <div style={{ color: 'var(--text-3)', fontSize: '0.76rem', marginTop: 2 }}>{g.due}</div>
                    </div>
                    <span className="num" style={{ fontWeight: 800, fontSize: '1rem', color: catColor(g.hue) }}>{pct}%</span>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.78rem' }}>
                      <span className="num" style={{ color: 'var(--text-2)', fontWeight: 600 }}>{money(g.saved).replace('.00', '')}</span>
                      <span className="num" style={{ color: 'var(--text-3)' }}>{money(g.target).replace('.00', '')}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 99, background: 'var(--surface-hi)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${showBars ? pct : 0}%`, background: catColor(g.hue), borderRadius: 99, transition: `width .9s cubic-bezier(.22,.9,.3,1) ${gi * 120}ms` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
