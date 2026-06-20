import React, { useEffect } from 'react';
import { Icon } from './Icon';

// ---- helpers ----
const CUR: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' };

export function money(n: number, cur = 'EUR', opts: { signed?: boolean } = {}): string {
  const sign = n < 0 ? '-' : (opts.signed && n > 0 ? '+' : '');
  const v = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return sign + (CUR[cur] || '') + v;
}

export function relTime(ts: number): string {
  const d = (Date.now() - ts) / 86400000;
  if (d < 0.04) return 'Just now';
  if (d < 1) return Math.round(d * 24) + 'h ago';
  if (d < 2) return 'Yesterday';
  if (d < 7) return Math.round(d) + 'd ago';
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function dayLabel(ts: number): string {
  const d = (Date.now() - ts) / 86400000;
  if (d < 1) return 'Today';
  if (d < 2) return 'Yesterday';
  return new Date(ts).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}

// Lightness/alpha come from CSS tokens so the hues stay readable in light mode
export const catColor = (hue: number) => `oklch(var(--cat-l, 0.68) 0.13 ${hue})`;
export const catSoft = (hue: number) => `oklch(var(--cat-l, 0.68) 0.13 ${hue} / var(--cat-soft-a, 0.16))`;

// ---- Avatar ----
interface AvatarProps { initials: string; hue?: number; size?: number; }
export function Avatar({ initials, hue = 265, size = 40 }: AvatarProps) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 'var(--r-pill)', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.36, color: catColor(hue),
      background: catSoft(hue), border: `1px solid oklch(var(--cat-l, 0.68) 0.13 ${hue} / 0.3)`,
      fontFamily: 'var(--font-display)', letterSpacing: '-0.02em',
    }}>{initials}</div>
  );
}

// ---- CategoryIcon ----
const CATS_META: Record<string, { hue: number; icon: string; label: string }> = {
  income:    { label: 'Income',           hue: 158, icon: 'arrowDownLeft' },
  transfer:  { label: 'Transfers',        hue: 265, icon: 'send' },
  groceries: { label: 'Groceries',        hue: 130, icon: 'cart' },
  dining:    { label: 'Dining & Cafés',   hue: 28,  icon: 'coffee' },
  transport: { label: 'Transport',        hue: 230, icon: 'car' },
  shopping:  { label: 'Shopping',        hue: 320, icon: 'bag' },
  bills:     { label: 'Bills & Utilities',hue: 200, icon: 'bolt' },
  subs:      { label: 'Subscriptions',   hue: 300, icon: 'repeat' },
  health:    { label: 'Health',           hue: 12,  icon: 'heart' },
  travel:    { label: 'Travel',           hue: 195, icon: 'plane' },
  deposit:   { label: 'Deposit',          hue: 158, icon: 'arrowDownLeft' },
};

export function CategoryIcon({ cat, size = 42 }: { cat: string; size?: number }) {
  const c = CATS_META[cat] || { hue: 265, icon: 'grid' };
  return (
    <div style={{
      width: size, height: size, borderRadius: 'var(--r)', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: catColor(c.hue), background: catSoft(c.hue),
    }}>
      <Icon name={c.icon} size={size * 0.46} />
    </div>
  );
}

export { CATS_META };

// ---- Sparkline ----
interface SparklineProps { data: number[]; w?: number; h?: number; color?: string; fill?: boolean; strokeW?: number; }
export function Sparkline({ data, w = 240, h = 64, color = 'var(--accent)', fill = true, strokeW = 2.5 }: SparklineProps) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const rng = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 6 - ((v - min) / rng) * (h - 14)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ` L${w} ${h} L0 ${h} Z`;
  const gid = 'sp' + Math.round(min + max + data.length);
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill={color} />
    </svg>
  );
}

// ---- Donut ----
interface DonutSegment { value: number; color: string; }
interface DonutProps { segments: DonutSegment[]; size?: number; thickness?: number; gap?: number; children?: React.ReactNode; }
export function Donut({ segments, size = 180, thickness = 22, gap = 0.02, children }: DonutProps) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const R = (size - thickness) / 2;
  const C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const frac = s.value / total;
          const len = Math.max(0, (frac - gap) * C);
          const dash = `${len} ${C - len}`;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={R} fill="none"
              stroke={s.color} strokeWidth={thickness} strokeDasharray={dash}
              strokeDashoffset={-off * C} strokeLinecap="round"
              style={{ transition: 'stroke-dasharray .6s ease' }} />
          );
          off += frac;
          return el;
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {children}
      </div>
    </div>
  );
}

// ---- Bars ----
interface BarData { m: string; in: number; out: number; }
export function Bars({ data, h = 150 }: { data: BarData[]; h?: number }) {
  const max = Math.max(...data.flatMap(d => [d.in, d.out])) || 1;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--gap)', height: h }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: '100%', width: '100%', justifyContent: 'center' }}>
            <div title={'In ' + d.in} style={{ width: '34%', height: `${(d.in / max) * 100}%`, background: 'var(--accent)', borderRadius: 'var(--r-xs) var(--r-xs) 2px 2px', minHeight: 4, transition: 'height .5s ease' }} />
            <div title={'Out ' + d.out} style={{ width: '34%', height: `${(d.out / max) * 100}%`, background: 'var(--surface-hi)', borderRadius: 'var(--r-xs) var(--r-xs) 2px 2px', minHeight: 4, transition: 'height .5s ease' }} />
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 600 }}>{d.m}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Progress Ring ----
interface RingProps { pct: number; size?: number; thickness?: number; color?: string; children?: React.ReactNode; }
export function Ring({ pct, size = 56, thickness = 6, color = 'var(--accent)', children }: RingProps) {
  const R = (size - thickness) / 2, C = 2 * Math.PI * R;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke={color} strokeWidth={thickness}
          strokeDasharray={`${(pct / 100) * C} ${C}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray .6s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  );
}

// ---- Segmented control ----
interface SegOption { value: string; label: string; }
interface SegmentedProps { value: string; options: (string | SegOption)[]; onChange: (v: string) => void; full?: boolean; }
export function Segmented({ value, options, onChange, full }: SegmentedProps) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-pill)', padding: 4, gap: 2, width: full ? '100%' : 'auto' }}>
      {options.map(o => {
        const v = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        const active = v === value;
        return (
          <button key={v} onClick={() => onChange(v)} style={{
            flex: full ? 1 : 'none', border: 'none', cursor: 'pointer',
            padding: '8px 16px', borderRadius: 'var(--r-pill)', fontWeight: 600, fontSize: '0.86rem',
            fontFamily: 'var(--font-body)',
            background: active ? 'var(--surface-hi)' : 'transparent',
            color: active ? 'var(--text)' : 'var(--text-3)',
            boxShadow: active ? 'var(--shadow-sm)' : 'none',
            transition: 'all .18s ease',
          }}>{label}</button>
        );
      })}
    </div>
  );
}

// ---- Sheet / Modal ----
interface SheetProps { open: boolean; onClose: () => void; title?: string; mobile?: boolean; children?: React.ReactNode; }
export function Sheet({ open, onClose, children, title, mobile }: SheetProps) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 60, background: 'oklch(0 0 0 / 0.5)',
      backdropFilter: 'blur(3px)', display: 'flex',
      alignItems: mobile ? 'flex-end' : 'center', justifyContent: 'center',
      padding: mobile ? 0 : 24, animation: 'fvFade .2s ease',
    }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{
        width: mobile ? '100%' : 'min(460px, 100%)', maxHeight: '92%', overflowY: 'auto',
        padding: 'var(--pad-lg)', boxShadow: 'var(--shadow)',
        borderRadius: mobile ? 'var(--r-xl) var(--r-xl) 0 0' : 'var(--r-xl)',
        animation: mobile ? 'fvRise .28s cubic-bezier(.22,.9,.3,1)' : 'fvPop .26s cubic-bezier(.22,.9,.3,1)',
      }}>
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--gap-lg)' }}>
            <h3 className="display" style={{ fontSize: '1.3rem', fontWeight: 700 }}>{title}</h3>
            <button className="btn btn-quiet" onClick={onClose} style={{ padding: 8, borderRadius: 'var(--r-pill)' }}><Icon name="x" size={20} /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ---- Toast ----
interface ToastData { title: string; body?: string; type: 'success' | 'warn' | 'info'; id?: number; }
export function Toast({ toast, embedded }: { toast: ToastData | null; embedded?: boolean }) {
  if (!toast) return null;
  const map: Record<string, string> = { success: 'var(--pos)', warn: 'var(--warn)', info: 'var(--accent-ink)' };
  return (
    <div style={{
      position: embedded ? 'absolute' : 'fixed', bottom: embedded ? 78 : 24, left: '50%', transform: 'translateX(-50%)', zIndex: 90,
      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px',
      background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-pill)',
      boxShadow: 'var(--shadow)', animation: 'fvRise .3s cubic-bezier(.22,.9,.3,1)', maxWidth: '90%',
      width: 'max-content',
    }}>
      <span style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: map[toast.type] || map.info, background: 'color-mix(in oklab, currentColor 16%, transparent)' }}>
        <Icon name={toast.type === 'success' ? 'check' : toast.type === 'warn' ? 'bell' : 'sparkle'} size={15} />
      </span>
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{toast.title}</div>
        {toast.body && <div style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{toast.body}</div>}
      </div>
    </div>
  );
}

// ---- Delta (stat pill) ----
export function Delta({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const up = value >= 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.8rem', fontWeight: 700, color: up ? 'var(--pos)' : 'var(--neg)' }}>
      <Icon name={up ? 'arrowUpRight' : 'arrowDownLeft'} size={13} stroke={2.5} />
      {Math.abs(value)}{suffix}
    </span>
  );
}

// ---- PageHead ----
export function PageHead({ title, subtitle, action, back }: { title: string; subtitle?: string; action?: React.ReactNode; back?: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {back && <button onClick={back} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text)' }}><Icon name="arrow-left" size={20} /></button>}
        <div>
          <h1 className="display" style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700 }}>{title}</h1>
          {subtitle && <p style={{ color: 'var(--text-2)', marginTop: 4 }}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// ---- Toggle ----
export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!on)} style={{ width: 44, height: 26, borderRadius: 99, background: on ? 'var(--accent)' : 'var(--surface-hi)', position: 'relative', transition: 'background .2s', flexShrink: 0, cursor: 'pointer' }}>
      <div style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: 'oklch(0.99 0 0)', transition: 'left .2s', boxShadow: '0 1px 3px oklch(0 0 0 / 0.3)' }} />
    </div>
  );
}
