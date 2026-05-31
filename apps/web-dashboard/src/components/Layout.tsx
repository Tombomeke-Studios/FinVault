import React from 'react';
import { Icon } from './Icons';

export function PageHead({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <h1 className="display" style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700 }}>{title}</h1>
        {subtitle && <p style={{ color: 'var(--text-2)', marginTop: 4 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionHead({ title, onAll, small }: { title: string; onAll?: () => void; small?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: small ? 0 : 12 }}>
      <h2 className="display" style={{ fontSize: small ? '1rem' : '1.15rem', fontWeight: 700 }}>{title}</h2>
      {onAll && <button onClick={onAll} className="btn btn-quiet" style={{ padding: '5px 8px', fontSize: '0.84rem', color: 'var(--accent)' }}>See all <Icon name="chevRight" size={15} /></button>}
    </div>
  );
}
