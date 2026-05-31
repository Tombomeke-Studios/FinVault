import React from 'react';
import { Icon } from './Icons';

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: size, height: size, borderRadius: 'calc(var(--r-sm))', background: 'var(--accent)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px -4px var(--accent-line)' }}>
        <Icon name="shield" size={size * 0.6} stroke={2.3} />
      </div>
      <span className="display" style={{ fontSize: size * 0.62, fontWeight: 700, letterSpacing: '-0.03em' }}>FinVault</span>
    </div>
  );
}
