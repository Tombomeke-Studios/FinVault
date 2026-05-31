import React from 'react';
import { Icon } from './Icon';

const SCHEMES: Record<string, { bg: string }> = {
  metal:  { bg: 'linear-gradient(135deg, oklch(0.32 0.02 265), oklch(0.20 0.02 265) 60%, oklch(0.14 0.015 265))' },
  violet: { bg: 'linear-gradient(135deg, oklch(0.55 0.18 300), oklch(0.40 0.16 290) 60%, oklch(0.30 0.12 285))' },
  cyan:   { bg: 'linear-gradient(135deg, oklch(0.62 0.13 220), oklch(0.45 0.12 230) 60%, oklch(0.32 0.09 235))' },
  gold:   { bg: 'linear-gradient(135deg, oklch(0.78 0.12 80), oklch(0.62 0.12 70) 55%, oklch(0.46 0.09 60))' },
  accent: { bg: 'linear-gradient(135deg, var(--accent-hi), var(--accent) 55%, var(--accent-lo))' },
};

export interface CardData {
  id: string;
  name: string;
  kind: 'physical' | 'virtual';
  network: string;
  last4: string;
  number: string;
  cvv: string;
  holder: string;
  exp: string;
  frozen: boolean;
  scheme: string;
  walletId: string;
  monthSpend: number;
  limit: number;
}

interface BankCardProps {
  card: CardData;
  width?: number;
  onClick?: () => void;
  selected?: boolean;
}

export function BankCard({ card, width = 340, onClick, selected }: BankCardProps) {
  const sc = SCHEMES[card.scheme] || SCHEMES.metal;
  const h = width * 0.63;
  return (
    <div onClick={onClick} style={{
      width, height: h, borderRadius: 'clamp(12px, calc(var(--r-lg) + 4px), 24px)', position: 'relative', overflow: 'hidden',
      background: sc.bg, color: 'oklch(0.99 0 0)', cursor: onClick ? 'pointer' : 'default',
      padding: width * 0.066, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      boxShadow: selected ? '0 0 0 2px var(--accent), 0 18px 40px -16px oklch(0 0 0 / 0.6)' : '0 18px 40px -18px oklch(0 0 0 / 0.55)',
      transition: 'transform .25s ease, box-shadow .25s ease', flexShrink: 0,
      filter: card.frozen ? 'saturate(0.4) brightness(0.85)' : 'none',
    }}>
      {/* sheen */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 85% -10%, oklch(1 0 0 / 0.18), transparent 50%)' }} />
      <div style={{ position: 'absolute', right: -width * 0.1, bottom: -width * 0.1, width: width * 0.5, height: width * 0.5, borderRadius: '50%', border: '1px solid oklch(1 0 0 / 0.1)' }} />
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: width * 0.04, opacity: 0.8, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>FinVault</div>
          <div className="display" style={{ fontSize: width * 0.052, fontWeight: 700, marginTop: 2 }}>{card.name}</div>
        </div>
        {card.frozen
          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: width * 0.036, fontWeight: 700, background: 'oklch(1 0 0 / 0.18)', padding: '4px 9px', borderRadius: 99 }}><Icon name="snow" size={width * 0.04} /> Frozen</span>
          : <Icon name="wallet" size={width * 0.08} stroke={1.6} style={{ opacity: 0.85 }} />}
      </div>
      <div style={{ position: 'relative' }}>
        {/* chip */}
        <div style={{ width: width * 0.1, height: width * 0.075, borderRadius: width * 0.014, background: 'linear-gradient(135deg, oklch(0.92 0.06 90), oklch(0.78 0.08 85))', marginBottom: width * 0.03 }} />
        <div className="num" style={{ fontSize: width * 0.062, letterSpacing: '0.12em', fontWeight: 500 }}>
          ●●●●&nbsp;&nbsp;●●●●&nbsp;&nbsp;●●●●&nbsp;&nbsp;{card.last4}
        </div>
      </div>
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: width * 0.032, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Card holder</div>
          <div style={{ fontSize: width * 0.044, fontWeight: 600, letterSpacing: '0.04em' }}>{card.holder}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: width * 0.032, opacity: 0.7 }}>Exp</div>
          <div className="num" style={{ fontSize: width * 0.044, fontWeight: 600 }}>{card.exp}</div>
        </div>
        <div className="display" style={{ fontSize: width * 0.06, fontWeight: 700, fontStyle: 'italic', letterSpacing: '-0.03em' }}>{card.network}</div>
      </div>
    </div>
  );
}
