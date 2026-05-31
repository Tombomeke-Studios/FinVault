import React, { useState } from 'react';
import { Icon } from '../components/Icon';
import { money, Sparkline, relTime, CategoryIcon, Ring, Donut, catColor, Delta, Avatar } from '../components/UI';
import { BankCard } from '../components/BankCard';
import type { AppData } from '../App';

interface SectionHeadProps { title: string; onAll?: () => void; small?: boolean; }
function SectionHead({ title, onAll, small }: SectionHeadProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: small ? 0 : 12 }}>
      <h2 className="display" style={{ fontSize: small ? '1rem' : '1.15rem', fontWeight: 700 }}>{title}</h2>
      {onAll && <button onClick={onAll} className="btn btn-quiet" style={{ padding: '5px 8px', fontSize: '0.84rem', color: 'var(--accent)' }}>See all <Icon name="chevRight" size={15} /></button>}
    </div>
  );
}

function QuickAction({ icon, label, onClick, primary }: { icon: string; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} className="btn" style={{
      flex: 1, flexDirection: 'column', gap: 9, padding: '16px 8px', minWidth: 72,
      background: primary ? 'var(--accent)' : 'var(--surface-2)',
      color: primary ? 'var(--on-accent)' : 'var(--text)',
      border: primary ? 'none' : '1px solid var(--line)',
    }}>
      <Icon name={icon} size={21} />
      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{label}</span>
    </button>
  );
}

interface OverviewProps {
  compact: boolean;
  navigate: (r: string) => void;
  data: AppData;
  onTopup: () => void;
}

export function ScreenOverview({ compact, navigate, data, onTopup }: OverviewProps) {
  const [selWallet, setSelWallet] = useState(0);
  const { wallets, transactions, cards, goals, spendByCat, balanceTrend } = data;

  const totalEUR = wallets.filter(w => w.currency === 'EUR').reduce((s, w) => s + w.balance, 0);
  const recent = transactions.slice(0, 5);
  const card = cards[0];
  const goalsPreview = goals.slice(0, 2);
  const topCats = [...spendByCat].sort((a, b) => b.amount - a.amount).slice(0, 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
      {/* Greeting */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="eyebrow">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 className="display" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.05rem)', fontWeight: 700, marginTop: 4 }}>Hi {data.user.firstName} 👋</h1>
        </div>
        <span className="chip chip-accent"><Icon name="sparkle" size={13} /> {data.user.plan}</span>
      </div>

      {/* Hero + quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1.5fr 1fr', gap: 'var(--gap-lg)' }}>
        <div className="card rise" style={{ padding: 'var(--pad-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--gap)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="eyebrow">Total balance · EUR</div>
              <div className="num display" style={{ fontSize: 'clamp(2.1rem, 5vw, 3rem)', fontWeight: 700, lineHeight: 1.05, marginTop: 6 }}>
                {money(totalEUR)}
              </div>
            </div>
            <Delta value={6.4} />
          </div>
          <div style={{ margin: '0 -6px' }}>
            <Sparkline data={balanceTrend} h={compact ? 60 : 78} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--gap-lg)', flexWrap: 'wrap' }}>
            {[['Money in', 3234.95, 'pos'] as const, ['Money out', -1879.40, 'neg'] as const].map(([l, v, k]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in oklab, var(--${k}) 16%, transparent)`, color: `var(--${k})` }}>
                  <Icon name={k === 'pos' ? 'arrowDownLeft' : 'arrowUpRight'} size={16} />
                </span>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>{l} · this month</div>
                  <div className="num" style={{ fontWeight: 700 }}>{money(v, 'EUR', { signed: true })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card rise" style={{ padding: 'var(--pad-lg)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 'var(--gap)' }}>
          <div className="eyebrow">Quick actions</div>
          <div style={{ display: 'flex', gap: 'var(--gap)', flexWrap: 'wrap' }}>
            <QuickAction icon="send" label="Send" primary onClick={() => navigate('transfer')} />
            <QuickAction icon="qr" label="Request" onClick={() => navigate('transfer')} />
            <QuickAction icon="plus" label="Top up" onClick={onTopup} />
            <QuickAction icon="bolt" label="Pay bill" onClick={() => navigate('transfer')} />
          </div>
        </div>
      </div>

      {/* Accounts strip */}
      <div>
        <SectionHead title="Your accounts" onAll={() => {}} />
        <div style={{ display: 'flex', gap: 'var(--gap)', overflowX: 'auto', paddingBottom: 4 }} className="hide-scroll">
          {wallets.map((wl, i) => (
            <div key={wl.id} onClick={() => setSelWallet(i)} className="card" style={{
              minWidth: 230, flex: compact ? '0 0 auto' : 1, padding: 'var(--pad)', cursor: 'pointer',
              borderColor: i === selWallet ? 'var(--accent-line)' : 'var(--line)',
              boxShadow: i === selWallet ? '0 0 0 1px var(--accent-line)' : 'none', transition: 'all .2s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '0.9rem' }}>
                  <Icon name={wl.type === 'savings' ? 'targetRing' : 'wallet'} size={17} style={{ color: 'var(--accent)' }} /> {wl.name || (wl.type === 'savings' ? 'Savings Vault' : 'Everyday')}
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-3)', fontWeight: 600 }}>{wl.currency}</span>
              </div>
              <div className="num display" style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 12 }}>{money(wl.balance, wl.currency)}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <span className="num" style={{ fontSize: '0.76rem', color: 'var(--text-3)' }}>{wl.iban}</span>
                {(wl.interestRate || 0) > 0 && <span className="chip" style={{ padding: '2px 8px', fontSize: '0.72rem' }}>{((wl.interestRate || 0) * 100).toFixed(1)}% APY</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two column: transactions + side */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1.5fr 1fr', gap: 'var(--gap-lg)' }}>
        <div className="card" style={{ padding: 'var(--pad)' }}>
          <div style={{ padding: '4px 6px' }}><SectionHead title="Recent activity" onAll={() => navigate('transactions')} /></div>
          <div>
            {recent.map(t => {
              const cat = t.type === 'deposit' ? 'deposit' : t.type === 'transfer' ? 'transfer' : 'transfer';
              const amtNum = typeof t.amount === 'number' ? t.amount : parseFloat(t.amount);
              const isIncoming = t.receiverWalletId && wallets.some(w => w.id === t.receiverWalletId);
              const displayAmt = isIncoming ? amtNum : -amtNum;
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 6px', borderTop: '1px solid var(--line)' }}>
                  <CategoryIcon cat={cat} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t.description || 'Transaction'}</div>
                    <div style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>{relTime(new Date(t.createdAt).getTime())}</div>
                  </div>
                  <div className="num" style={{ fontWeight: 700, color: displayAmt > 0 ? 'var(--pos)' : 'var(--text)' }}>{money(displayAmt, t.currency || 'EUR', { signed: true })}</div>
                </div>
              );
            })}
            {recent.length === 0 && <p style={{ padding: '20px 6px', color: 'var(--text-3)', fontSize: '0.9rem' }}>No transactions yet.</p>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
          {card && (
            <div className="card" style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SectionHead title="My card" onAll={() => navigate('cards')} small />
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <BankCard card={card} width={compact ? 280 : 250} onClick={() => navigate('cards')} />
              </div>
            </div>
          )}
          {topCats.length > 0 && (
            <div className="card" style={{ padding: 'var(--pad)' }}>
              <SectionHead title="May spending" onAll={() => navigate('analytics')} small />
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-lg)', marginTop: 10 }}>
                <Donut size={108} thickness={16} segments={topCats.map(c => ({ value: c.amount, color: catColor(c.hue) }))}>
                  <div className="num display" style={{ fontSize: '1rem', fontWeight: 700 }}>{money(spendByCat.reduce((s, x) => s + x.amount, 0)).replace('.00', '')}</div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-3)' }}>spent</div>
                </Donut>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topCats.map(c => (
                    <div key={c.cat} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem' }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: catColor(c.hue) }} />
                      <span style={{ flex: 1, color: 'var(--text-2)' }}>{c.label}</span>
                      <span className="num" style={{ fontWeight: 600 }}>{money(c.amount).replace('.00', '')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Goals preview */}
      {goals.length > 0 && (
        <div className="card" style={{ padding: 'var(--pad)' }}>
          <div style={{ padding: '4px 6px' }}><SectionHead title="Savings goals" onAll={() => navigate('savings')} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: 'var(--gap)', marginTop: 6 }}>
            {goalsPreview.map(g => {
              const pct = Math.round((g.saved / g.target) * 100);
              return (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 6px' }}>
                  <Ring pct={pct} size={52} thickness={6} color={catColor(g.hue)}>
                    <Icon name={g.icon} size={18} style={{ color: catColor(g.hue) }} />
                  </Ring>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{g.name}</span>
                      <span className="num" style={{ fontWeight: 700, fontSize: '0.9rem' }}>{pct}%</span>
                    </div>
                    <div style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: 2 }} className="num">{money(g.saved).replace('.00', '')} of {money(g.target).replace('.00', '')}</div>
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
