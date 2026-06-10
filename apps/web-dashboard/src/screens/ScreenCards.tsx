import React, { useState, useRef } from 'react';
import { Icon } from '../components/Icon';
import { money, Ring, PageHead, Sheet } from '../components/UI';
import { BankCard } from '../components/BankCard';
import type { AppData } from '../App';

function SettingRow({ icon, label, desc, toggle, def, action, on, last }: { icon: string; label: string; desc: string; toggle?: boolean; def?: boolean; action?: () => void; on?: boolean; last?: boolean }) {
  const [v, setV] = useState(def || false);
  const active = toggle ? v : on;
  return (
    <div onClick={() => toggle ? setV(x => !x) : action && action()} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 4px', borderBottom: last ? 'none' : '1px solid var(--line)', cursor: 'pointer' }}>
      <span style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}><Icon name={icon} size={18} /></span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{label}</div>
        <div style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>{desc}</div>
      </div>
      <div style={{ width: 44, height: 26, borderRadius: 99, background: active ? 'var(--accent)' : 'var(--surface-hi)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 3, left: active ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: 'oklch(0.99 0 0)', transition: 'left .2s', boxShadow: '0 1px 3px oklch(0 0 0 / 0.3)' }} />
      </div>
    </div>
  );
}

function DetailRow({ label, value, onCopy, mono, grow }: { label: string; value: string; onCopy?: () => void; mono?: boolean; grow?: boolean }) {
  return (
    <div style={{ flex: grow ? 1 : 'none', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.74rem', color: 'var(--text-3)', fontWeight: 600 }}>{label}</div>
        <div className={mono ? 'num' : ''} style={{ fontWeight: 600, fontSize: '0.98rem', letterSpacing: mono ? '0.04em' : 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      </div>
      {onCopy && <button className="btn btn-quiet" onClick={onCopy} style={{ padding: 7, color: 'var(--accent)', flexShrink: 0 }}><Icon name="copy" size={16} /></button>}
    </div>
  );
}

function CardCarousel({ cards, sel, setSel, compact }: { cards: any[]; sel: number; setSel: (i: number) => void; compact: boolean }) {
  const drag = useRef<{ x: number | null; w: number }>({ x: null, w: 0 });
  const [dx, setDx] = useState(0);
  const cardW = compact ? 290 : 330;
  const down = (e: React.PointerEvent) => { drag.current.x = e.clientX; drag.current.w = e.currentTarget.getBoundingClientRect().width || 320; (e.currentTarget as HTMLElement).setPointerCapture && (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); };
  const move = (e: React.PointerEvent) => { if (drag.current.x == null) return; setDx(e.clientX - drag.current.x!); };
  const up = () => { if (drag.current.x == null) return; const d = dx; if (d < -45 && sel < cards.length - 1) setSel(sel + 1); else if (d > 45 && sel > 0) setSel(sel - 1); drag.current = { x: null, w: 0 }; setDx(0); };
  const arrowStyle = (side: 'left' | 'right'): React.CSSProperties => ({ position: 'absolute', top: '50%', [side]: 2, transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: '50%', border: '1px solid var(--line-2)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', zIndex: 2 });
  return (
    <div style={{ width: '100%', position: 'relative', overflow: 'hidden' }}>
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} style={{ display: 'flex', width: '100%', alignItems: 'center', touchAction: 'pan-y', cursor: cards.length > 1 ? 'grab' : 'default', transform: `translateX(calc(${-sel * 100}% + ${dx}px))`, transition: dx ? 'none' : 'transform .32s cubic-bezier(.22,.9,.3,1)' }}>
        {cards.map((c, i) => (
          <div key={c.id} style={{ flex: '0 0 100%', width: '100%', minWidth: 0, display: 'flex', justifyContent: 'center', padding: '4px 0', opacity: i === sel ? 1 : 0.45, transition: 'opacity .3s' }}>
            <BankCard card={c} width={cardW} />
          </div>
        ))}
      </div>
      {!compact && cards.length > 1 && sel > 0 && <button onClick={() => setSel(sel - 1)} aria-label="Previous" style={arrowStyle('left')}><Icon name="chevLeft" size={18} /></button>}
      {!compact && cards.length > 1 && sel < cards.length - 1 && <button onClick={() => setSel(sel + 1)} aria-label="Next" style={arrowStyle('right')}><Icon name="chevRight" size={18} /></button>}
    </div>
  );
}

export function ScreenCards({ compact, fire, data, cards, setCards, token, navigate }: { compact: boolean; fire: (t: string, b: string, type?: string) => void; data: AppData; cards: any[]; setCards: React.Dispatch<React.SetStateAction<any[]>>; token?: string | null; navigate?: (r: string) => void }) {
  const [sel, setSel] = useState(0);
  const [details, setDetails] = useState(false);
  const [reveal, setReveal] = useState(false);

  // Stateful Modals / Forms
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardKind, setNewCardKind] = useState<'physical' | 'virtual'>('virtual');
  const [newCardScheme, setNewCardScheme] = useState('violet');

  const [limitsOpen, setLimitsOpen] = useState(false);
  const [limitVal, setLimitVal] = useState(2000);

  const card = cards[sel];
  const iban = (data.wallets.find(w => w.id === card?.walletId) || {}).iban || '';

  const copy = (text: string, label: string) => {
    try { navigator.clipboard && navigator.clipboard.writeText(text.replace(/\s/g, '')); } catch (e) {}
    fire('Copied', label, 'success');
  };

  const toggleFreeze = async () => {
    if (!token || token.startsWith('mock-token')) {
      setCards(cs => cs.map((c, i) => i === sel ? { ...c, frozen: !c.frozen } : c));
      fire(card.frozen ? 'Card unfrozen' : 'Card frozen', card.frozen ? 'Payments re-enabled.' : 'All payments are now blocked.', card.frozen ? 'success' : 'warn');
      return;
    }
    try {
      const res = await fetch(`/api/cards/${card.id}/freeze`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ frozen: !card.frozen })
      });
      if (res.ok) {
        const updated = await res.json();
        setCards(cs => cs.map(c => c.id === card.id ? updated : c));
        fire(updated.frozen ? 'Card frozen' : 'Card unfrozen', updated.frozen ? 'All payments are now blocked.' : 'Payments re-enabled.', updated.frozen ? 'warn' : 'success');
      }
    } catch (e: any) {
      fire('Error', 'Failed to update card status: ' + e.message, 'error');
    }
  };

  const handleOrderCard = async () => {
    if (!token || token.startsWith('mock-token')) {
      const last4 = Math.floor(1000 + Math.random() * 9000).toString();
      const newCard = {
        id: 'card-' + Date.now(),
        name: newCardName,
        kind: newCardKind,
        network: newCardKind === 'physical' ? 'Visa' : 'Mastercard',
        last4,
        number: `4182 ${Math.floor(1000+Math.random()*9000)} ${Math.floor(1000+Math.random()*9000)} ${last4}`,
        cvv: Math.floor(100 + Math.random() * 900).toString(),
        holder: card?.holder || `${data.user.firstName} ${data.user.lastName}`,
        exp: '12/30',
        frozen: false,
        scheme: newCardScheme,
        walletId: card?.walletId || data.wallets[0]?.id || 'mock-wallet-eur',
        monthSpend: 0,
        limit: 2000,
      };
      setCards(prev => [...prev, newCard]);
      setNewCardOpen(false);
      setNewCardName('');
      setSel(cards.length); // Swaps carousel index to show the newly ordered card!
      fire('Success', `Your new ${newCardKind} card (${newCardName}) has been created!`, 'success');
      return;
    }

    try {
      const walletId = data.wallets[0]?.id;
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newCardName,
          kind: newCardKind,
          scheme: newCardScheme,
          walletId,
          limit: 2000,
          holder: `${data.user.firstName} ${data.user.lastName}`
        })
      });
      if (res.ok) {
        const created = await res.json();
        setCards(prev => [...prev, created]);
        setNewCardOpen(false);
        setNewCardName('');
        setSel(cards.length);
        fire('Success', `Your new ${created.kind} card (${created.name}) has been ordered!`, 'success');
      }
    } catch (e: any) {
      fire('Error', 'Failed to order card: ' + e.message, 'error');
    }
  };

  const handleSaveLimits = async () => {
    if (!token || token.startsWith('mock-token')) {
      setCards(cs => cs.map((c, i) => i === sel ? { ...c, limit: limitVal } : c));
      setLimitsOpen(false);
      fire('Limits Updated', `Monthly spending cap updated to ${money(limitVal)}.`, 'success');
      return;
    }

    try {
      const res = await fetch(`/api/cards/${card.id}/limit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ limit: limitVal })
      });
      if (res.ok) {
        const updated = await res.json();
        setCards(cs => cs.map(c => c.id === card.id ? updated : c));
        setLimitsOpen(false);
        fire('Limits Updated', `Monthly spending cap updated to ${money(updated.limit)}.`, 'success');
      }
    } catch (e: any) {
      fire('Error', 'Failed to update limit: ' + e.message, 'error');
    }
  };

  if (!card) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>No cards found.</div>;

  const settings = [
    { icon: 'snow', label: card.frozen ? 'Unfreeze card' : 'Freeze card', desc: 'Instantly block all payments', action: toggleFreeze, on: card.frozen },
    { icon: 'globe', label: 'Online payments', desc: 'E-commerce & subscriptions', toggle: true, def: true },
    { icon: 'plane', label: 'Foreign transactions', desc: 'Use abroad', toggle: true, def: card.scheme !== 'metal' },
    { icon: 'lock', label: 'Contactless', desc: 'Tap to pay', toggle: true, def: true },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
      <PageHead title="Cards" subtitle="Manage your physical and virtual cards." action={
        <button className="btn btn-ghost" onClick={() => setNewCardOpen(true)}><Icon name="plus" size={17} /> {compact ? '' : 'New card'}</button>
      } />

      <div style={{ display: 'grid', gridTemplateColumns: compact ? 'minmax(0, 1fr)' : 'minmax(320px, 400px) minmax(0, 1fr)', gap: 'var(--gap-lg)', alignItems: 'start' }}>
        {/* Card carousel */}
        <div className="card rise" style={{ padding: 'var(--pad-lg)', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--gap)', alignItems: 'center' }}>
          <CardCarousel cards={cards} sel={sel} setSel={setSel} compact={compact} />
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {cards.map((_, i) => <button key={i} onClick={() => setSel(i)} aria-label={'Card ' + (i + 1)} style={{ width: i === sel ? 22 : 7, height: 7, border: 'none', padding: 0, borderRadius: 99, background: i === sel ? 'var(--accent)' : 'var(--surface-hi)', cursor: 'pointer', transition: 'all .25s' }} />)}
          </div>
          <div style={{ display: 'flex', gap: 'var(--gap)', width: '100%', marginTop: 4 }}>
            <button className="btn btn-ghost btn-block" onClick={toggleFreeze} style={{ flexDirection: 'column', gap: 6, padding: '14px', color: card.frozen ? 'var(--warn)' : 'var(--text)' }}>
              <Icon name="snow" size={20} /> <span style={{ fontSize: '0.8rem' }}>{card.frozen ? 'Unfreeze' : 'Freeze'}</span>
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => { setReveal(false); setDetails(true); }} style={{ flexDirection: 'column', gap: 6, padding: '14px' }}>
              <Icon name="eye" size={20} /> <span style={{ fontSize: '0.8rem' }}>Details</span>
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => { setLimitVal(card.limit); setLimitsOpen(true); }} style={{ flexDirection: 'column', gap: 6, padding: '14px' }}>
              <Icon name="settings" size={20} /> <span style={{ fontSize: '0.8rem' }}>Limits</span>
            </button>
          </div>
        </div>

        {/* Controls + spend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
          <div className="card" style={{ padding: 'var(--pad-lg)', display: 'flex', alignItems: 'center', gap: 'var(--gap-lg)', flexWrap: 'wrap' }}>
            <Ring pct={Math.min(100, (card.monthSpend / card.limit) * 100)} size={92} thickness={9}>
              <div style={{ textAlign: 'center' }}>
                <div className="num display" style={{ fontSize: '1.05rem', fontWeight: 700 }}>{Math.round(Math.min(100, (card.monthSpend / card.limit) * 100))}%</div>
              </div>
            </Ring>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div className="eyebrow">Spent this month</div>
              <div className="num display" style={{ fontSize: '1.7rem', fontWeight: 700, marginTop: 2 }}>{money(card.monthSpend)}</div>
              <div style={{ color: 'var(--text-2)', fontSize: '0.88rem' }}>of {money(card.limit)} monthly limit</div>
            </div>
            <span className="chip">{card.kind === 'physical' ? '◆ Physical' : '⬡ Virtual'} · {card.network}</span>
          </div>

          <div className="card" style={{ padding: 'var(--pad)', display: 'flex', flexDirection: 'column' }}>
            {settings.map((s, i) => <SettingRow key={i} {...s} last={i === settings.length - 1} />)}
            {card.walletId && navigate && (
              <div
                onClick={() => navigate(`account:${card.walletId}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 4px', borderTop: '1px solid var(--line)', cursor: 'pointer', marginTop: 2 }}
              >
                <span style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                  <Icon name="wallet" size={18} />
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>View Linked Account</div>
                  <div style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>Balance, activity &amp; add money</div>
                </div>
                <Icon name="chevRight" size={16} style={{ color: 'var(--text-3)' }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card details sheet */}
      <Sheet open={details} onClose={() => setDetails(false)} mobile={compact} title="Card details">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}><BankCard card={card} width={300} /></div>
          <button className="btn btn-ghost btn-block" onClick={() => setReveal(r => !r)}>
            <Icon name={reveal ? 'eyeOff' : 'eye'} size={17} /> {reveal ? 'Hide sensitive details' : 'Reveal sensitive details'}
          </button>
          <DetailRow label="Card number" value={reveal ? card.number : '•••• •••• •••• ' + card.last4} onCopy={reveal ? () => copy(card.number, 'Card number copied') : undefined} mono />
          <div style={{ display: 'flex', gap: 'var(--gap)' }}>
            <DetailRow label="Expiry" value={card.exp} mono grow />
            <DetailRow label="CVV" value={reveal ? card.cvv : '•••'} mono grow />
          </div>
          <DetailRow label="Linked IBAN" value={iban} onCopy={() => copy(iban, 'IBAN copied')} mono />
          <DetailRow label="Card holder" value={card.holder} />
          <p style={{ fontSize: '0.78rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="lock" size={13} /> Never share these details.</p>
        </div>
      </Sheet>

      {/* Order Card Sheet */}
      <Sheet open={newCardOpen} onClose={() => setNewCardOpen(false)} mobile={compact} title="Order a New Card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
          <p style={{ color: 'var(--text-2)', fontSize: '0.92rem' }}>Design your virtual or physical FinVault card instantly.</p>
          
          <label className="label">Card Nickname</label>
          <input className="field" value={newCardName} onChange={e => setNewCardName(e.target.value)} placeholder="e.g. Subscriptions, Groceries" autoFocus />

          <label className="label">Card Type</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {['physical', 'virtual'].map(k => (
              <button key={k} onClick={() => setNewCardKind(k as any)} className="btn btn-ghost" style={{ flex: 1, border: newCardKind === k ? '2.5px solid var(--accent)' : '1px solid var(--line)', background: newCardKind === k ? 'var(--accent-soft)' : 'transparent', color: newCardKind === k ? 'var(--accent)' : 'var(--text)', padding: 12 }}>
                {k === 'physical' ? '◆ Physical' : '⬡ Virtual'}
              </button>
            ))}
          </div>

          <label className="label">Card Design & Color</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['metal', 'violet', 'cyan', 'gold', 'accent'].map(sc => (
              <button key={sc} onClick={() => setNewCardScheme(sc)} className="chip" style={{ flex: 1, justifyContent: 'center', border: newCardScheme === sc ? '1.5px solid var(--accent)' : '1px solid var(--line)', background: newCardScheme === sc ? 'var(--accent-soft)' : 'var(--surface-2)', color: newCardScheme === sc ? 'var(--accent)' : 'var(--text-2)', padding: '10px 4px', textTransform: 'capitalize', cursor: 'pointer' }}>
                {sc}
              </button>
            ))}
          </div>

          <button className="btn btn-primary btn-block" onClick={handleOrderCard} disabled={!newCardName} style={{ marginTop: 14, padding: 14 }}>
            Order Card
          </button>
        </div>
      </Sheet>

      {/* Card Limits Sheet */}
      <Sheet open={limitsOpen} onClose={() => setLimitsOpen(false)} mobile={compact} title="Card Limits & Controls">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
          <p style={{ color: 'var(--text-2)', fontSize: '0.92rem' }}>Adjust spending controls for **{card?.name}** card.</p>
          
          <label className="label">Monthly Spending Limit (€)</label>
          <input className="field num" type="number" value={limitVal} onChange={e => setLimitVal(parseInt(e.target.value) || 0)} style={{ fontSize: '1.4rem', fontWeight: 700, textAlign: 'center', padding: 12 }} />
          
          <div style={{ display: 'flex', gap: 8 }}>
            {[500, 1000, 2000, 5000].map(v => (
              <button key={v} onClick={() => setLimitVal(v)} className="chip" style={{ flex: 1, justifyContent: 'center', cursor: 'pointer', padding: '10px 0' }}>€{v}</button>
            ))}
          </div>

          <button className="btn btn-primary btn-block" onClick={handleSaveLimits} style={{ marginTop: 14, padding: 14 }}>
            Save Settings
          </button>
        </div>
      </Sheet>
    </div>
  );
}
