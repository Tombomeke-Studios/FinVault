import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { BankCard } from './BankCard';
import { Ring } from './UI';

// ── CountUp ───────────────────────────────────────────────────────────────
export function CountUp({ value, prefix = '', suffix = '', decimals = 0, duration = 900, className }: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const start = useRef(Date.now());
  const from = useRef(0);

  useEffect(() => {
    from.current = display;
    start.current = Date.now();
    let animFrame: number;
    const step = () => {
      const t = Math.min(1, (Date.now() - start.current) / duration);
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(from.current + (value - from.current) * ease);
      if (t < 1) animFrame = requestAnimationFrame(step);
      else setDisplay(value);
    };
    animFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animFrame);
  }, [value, duration]);

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <span className={className || 'num'}>{prefix}{fmt(display)}{suffix}</span>;
}

// ── Screen transition wrapper ─────────────────────────────────────────────
export function ScreenTransition({ route, direction, children }: { route: string; direction: 'forward' | 'back'; children: React.ReactNode }) {
  const cls = direction === 'back' ? 'slide-left' : 'slide-right';
  return (
    <div key={route} className={cls} style={{ willChange: 'transform' }}>
      {children}
    </div>
  );
}

// ── Drag-to-dismiss bottom sheet ─────────────────────────────────────────
export function MobileSheet({ open, onClose, title, children, full }: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  const [drag, setDrag] = useState(0);
  const y0 = useRef<number | null>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, onClose]);

  if (!open) return null;

  const onDown = (e: React.TouchEvent | React.MouseEvent) => {
    y0.current = 'touches' in e ? e.touches[0].clientY : e.clientY;
  };
  const onMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (y0.current == null) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const dy = clientY - y0.current;
    if (dy > 0) setDrag(dy);
  };
  const onUp = () => {
    if (drag > 80) onClose();
    setDrag(0);
    y0.current = null;
  };

  const opacity = Math.max(0.3, 1 - drag / 300);
  const translateY = drag;

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end',
      background: `oklch(0 0 0 / ${0.55 * opacity})`, backdropFilter: 'blur(3px)',
      animation: 'fvFade .18s ease',
    }}>
      <div onClick={e => e.stopPropagation()}
        onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
        style={{
          width: '100%', background: 'var(--surface)', borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
          maxHeight: full ? '93%' : '85%', overflowY: 'auto',
          transform: `translateY(${translateY}px)`, transition: drag > 0 ? 'none' : 'transform .25s ease',
          animation: 'fvSheetUp .28s cubic-bezier(.22,.9,.3,1)',
          boxShadow: '0 -8px 40px -8px oklch(0 0 0 / 0.4)',
        }}>
        {/* Drag handle */}
        <div style={{ padding: '14px 0 8px', display: 'flex', justifyContent: 'center', cursor: 'grab' }}>
          <div style={{ width: 38, height: 5, borderRadius: 99, background: 'var(--surface-hi)' }} />
        </div>
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 var(--pad-lg) 12px' }}>
            <h3 className="display" style={{ fontSize: '1.25rem', fontWeight: 700 }}>{title}</h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 8 }}><Icon name="x" size={20} /></button>
          </div>
        )}
        <div style={{ padding: '0 var(--pad-lg) 32px' }}>{children}</div>
      </div>
    </div>
  );
}

// ── 3D Card flip + detail rows ────────────────────────────────────────────
export function MobileCardDetail({ card, open, onClose, wallets, fire }: {
  card: any;
  open: boolean;
  onClose: () => void;
  wallets: any[];
  fire: (t: string, b: string, type?: string) => void;
}) {
  const [revealed, setReveal] = useState(false);
  const [copied, setCopied] = useState('');
  const wallet = wallets.find(w => w.id === card.walletId) || {};
  useEffect(() => { if (!open) { setReveal(false); setCopied(''); } }, [open]);

  const copy = (text: string, label: string) => {
    try { navigator.clipboard && navigator.clipboard.writeText(text.replace(/\s/g, '')); } catch (e) {}
    setCopied(label);
    fire('Copied', label + ' copied to clipboard.', 'success');
    setTimeout(() => setCopied(''), 1800);
  };

  const cardW = 292;
  const cardH = Math.round(cardW * 0.63);

  const rows = [
    { label: 'Card number', value: revealed ? card.number : '•••• •••• •••• ' + card.last4, copy: card.number },
    { label: 'Expiry', value: card.exp },
    { label: 'CVV', value: revealed ? card.cvv : '•••', copy: card.cvv },
    { label: 'Linked IBAN', value: wallet.iban || '', copy: wallet.iban || '' },
    { label: 'Card holder', value: card.holder },
    { label: 'Network', value: card.network },
  ];

  return (
    <MobileSheet open={open} onClose={onClose} full>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
        {/* 3D flip card */}
        <div style={{ perspective: 900, width: cardW, margin: '0 auto 4px', height: cardH }}>
          <div style={{
            width: '100%', height: '100%', position: 'relative',
            transformStyle: 'preserve-3d', transition: 'transform .55s cubic-bezier(.22,.9,.3,1)',
            transform: revealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}>
            {/* Front */}
            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
              <BankCard card={card} width={cardW} />
            </div>
            {/* Back */}
            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
              <BankCard card={{ ...card, showBack: true }} width={cardW} />
            </div>
          </div>
        </div>

        {/* Reveal toggle */}
        <button className="btn btn-ghost btn-block" onClick={() => setReveal(r => !r)} style={{ gap: 10 }}>
          <Icon name={revealed ? 'eyeOff' : 'eye'} size={18} />
          {revealed ? 'Hide sensitive details' : 'Tap to reveal card details'}
        </button>

        {/* Info rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rows.map((r, i) => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', background: i % 2 === 0 ? 'var(--surface-2)' : 'transparent', borderRadius: 'var(--r)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.73rem', color: 'var(--text-3)', fontWeight: 600 }}>{r.label}</div>
                <div className="num" style={{ fontWeight: 600, fontSize: '0.98rem', letterSpacing: '0.02em' }}>{r.value}</div>
              </div>
              {r.copy && revealed && (
                <button onClick={() => copy(r.copy!, r.label)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied === r.label ? 'var(--pos)' : 'var(--accent)', padding: 8, transition: 'color .2s' }}>
                  <Icon name={copied === r.label ? 'check' : 'copy'} size={18} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 0', color: 'var(--text-3)', fontSize: '0.78rem' }}>
          <Icon name="lock" size={14} />
          <span>Never share these details. FinVault will never ask for your CVV.</span>
        </div>
      </div>
    </MobileSheet>
  );
}

// ── Limits sheet ──────────────────────────────────────────────────────────
export function LimitsSheet({ card, open, onClose, fire }: {
  card: any;
  open: boolean;
  onClose: () => void;
  fire: (t: string, b: string, type?: string) => void;
}) {
  const [monthLimit, setMonthLimit] = useState(card.limit || 2000);
  const [atmLimit, setAtmLimit] = useState(500);
  const [onlineLimit, setOnlineLimit] = useState(300);
  const [contactless, setContactless] = useState(true);
  const [foreign, setForeign] = useState(true);

  const Toggle = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => (
    <div onClick={() => onChange(!on)} style={{ width: 44, height: 26, borderRadius: 99, background: on ? 'var(--accent)' : 'var(--surface-hi)', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background .2s' }}>
      <div style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px oklch(0 0 0 / 0.3)' }} />
    </div>
  );

  const LimitRow = ({ label, icon, value, set, min, max, step = 50, format = (v: number) => '€' + v.toLocaleString() }: {
    label: string;
    icon: string;
    value: number;
    set: (v: number) => void;
    min: number;
    max: number;
    step?: number;
    format?: (v: number) => string;
  }) => (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}><Icon name={icon} size={17} /></span>
          <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{label}</span>
        </div>
        <span className="num" style={{ fontWeight: 700, color: 'var(--accent)' }}>{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => set(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)', height: 5 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.72rem', color: 'var(--text-3)' }}>
        <span>{format(min)}</span><span>{format(max)}</span>
      </div>
    </div>
  );

  return (
    <MobileSheet open={open} onClose={onClose} title="Card limits" full>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ marginBottom: 8 }}>
          <div className="eyebrow" style={{ paddingLeft: 2, marginBottom: 14 }}>Spending limits</div>
          <LimitRow label="Monthly spend" icon="card" value={monthLimit} set={setMonthLimit} min={200} max={10000} />
          <LimitRow label="ATM withdrawal" icon="wallet" value={atmLimit} set={setAtmLimit} min={100} max={2000} />
          <LimitRow label="Online per transaction" icon="bolt" value={onlineLimit} set={setOnlineLimit} min={50} max={2000} />
        </div>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
          <div className="eyebrow" style={{ paddingLeft: 2, marginBottom: 14 }}>Card controls</div>
          {[
            { label: 'Contactless payments', icon: 'send', on: contactless, set: setContactless },
            { label: 'Foreign transactions', icon: 'plane', on: foreign, set: setForeign },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}><Icon name={r.icon} size={17} /></span>
              <span style={{ flex: 1, fontWeight: 600, fontSize: '0.92rem' }}>{r.label}</span>
              <Toggle on={r.on} onChange={r.set} />
            </div>
          ))}
        </div>

        <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} onClick={() => {
          onClose();
          fire('Limits saved', 'Your card limits have been updated.', 'success');
        }}>Save limits</button>
      </div>
    </MobileSheet>
  );
}

// ── Animated balance ring (for home screen) ───────────────────────────────
export function AnimatedRing({ pct, size, thickness, children }: { pct: number; size: number; thickness: number; children: React.ReactNode }) {
  const [animPct, setAnimPct] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setAnimPct(pct), 100);
    return () => clearTimeout(id);
  }, [pct]);
  return <Ring pct={animPct} size={size} thickness={thickness}>{children}</Ring>;
}
