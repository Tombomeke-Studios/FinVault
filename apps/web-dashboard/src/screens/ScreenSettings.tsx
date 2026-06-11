import React, { useState } from 'react';
import { Icon } from '../components/Icon';
import { Avatar, Segmented, Toggle, PageHead } from '../components/UI';
import { ACCENTS, FONTS, PRESETS, type ThemeConfig } from '../theme';
import type { AppData } from '../App';

function SettingRow({ icon, label, desc, right, onClick, last }: { icon?: string; label: string; desc?: string; right?: React.ReactNode; onClick?: () => void; last?: boolean }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 4px', borderBottom: last ? 'none' : '1px solid var(--line)', cursor: onClick ? 'pointer' : 'default' }}>
      {icon && <span style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', flexShrink: 0 }}><Icon name={icon} size={18} /></span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{label}</div>
        {desc && <div style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>{desc}</div>}
      </div>
      {right}
    </div>
  );
}

function SCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {title && <div className="eyebrow" style={{ paddingLeft: 4 }}>{title}</div>}
      <div className="card" style={{ padding: 'var(--pad)' }}>{children}</div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, padding: '11px 4px', flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{label}</span>
      {children}
    </div>
  );
}

interface SettingsProps {
  compact: boolean;
  theme: ThemeConfig;
  setTheme: (t: ThemeConfig | ((k: keyof ThemeConfig, v: string) => ThemeConfig)) => void;
  fire: (title: string, body: string, type?: string) => void;
  openUpgrade: () => void;
  onLogout: () => void;
  data: AppData;
}

export function ScreenSettings({ compact, theme, setTheme, fire, openUpgrade, onLogout, data }: SettingsProps) {
  const [sec, setSec] = useState({ twoFA: true, push: true, email: false, marketing: false });
  const tg = (k: keyof typeof sec) => setSec(s => ({ ...s, [k]: !s[k] }));

  const applyPreset = (name: string) => setTheme(PRESETS[name] as any);
  const setTweak = (k: keyof ThemeConfig, v: string) => setTheme({ ...theme, [k]: v } as any);

  const activePreset = Object.entries(PRESETS).find(([, p]) => Object.keys(p).every(k => (p as any)[k] === (theme as any)[k]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)', maxWidth: 820, margin: '0 auto', width: '100%' }}>
      <PageHead title="Settings" subtitle="Personalise FinVault and manage your account." />

      {/* Profile */}
      <div className="card rise" style={{ padding: 'var(--pad-lg)', display: 'flex', alignItems: 'center', gap: 'var(--gap)', flexWrap: 'wrap' }}>
        <Avatar initials={data.user.initials} hue={265} size={64} />
        <div style={{ flex: 1, minWidth: 160 }}>
          <div className="display" style={{ fontSize: '1.3rem', fontWeight: 700 }}>{data.user.firstName} {data.user.lastName}</div>
          <div style={{ color: 'var(--text-2)', fontSize: '0.9rem' }}>{data.user.email}</div>
          <span className="chip chip-accent" style={{ marginTop: 8 }}><Icon name="sparkle" size={12} /> {data.user.plan}</span>
        </div>
      </div>

      {/* Appearance */}
      <SCard title="Appearance">
        <div style={{ padding: '4px 4px 12px' }}>
          <div style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: 10 }}>Theme preset</div>
          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr' : 'repeat(5, 1fr)', gap: 8 }}>
            {Object.entries(PRESETS).map(([name, p]) => {
              const a = ACCENTS[p.accent];
              const isActive = activePreset && activePreset[0] === name;
              return (
                <button key={name} onClick={() => applyPreset(name)} style={{
                  cursor: 'pointer', borderRadius: 'var(--r)', padding: '12px 10px', textAlign: 'left',
                  border: isActive ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                  background: isActive ? 'var(--accent-soft)' : 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <span style={{ display: 'flex', gap: 4 }}>
                    <span style={{ width: 18, height: 18, borderRadius: 6, background: a.sw }} />
                    <span style={{ width: 18, height: 18, borderRadius: 6, background: p.mode === 'dark' ? 'oklch(0.2 0.01 265)' : 'oklch(0.95 0.005 95)', border: '1px solid var(--line-2)' }} />
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{name}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--line)' }}>
          <FieldRow label="Appearance"><Segmented value={theme.mode} options={['dark', 'light']} onChange={v => setTweak('mode', v)} /></FieldRow>
        </div>
        <FieldRow label="Accent color">
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(ACCENTS).map(([k, a]) => {
              const isActive = theme.accent === k;
              return <button key={k} onClick={() => setTweak('accent', k)} aria-label={k} style={{ width: 30, height: 30, borderRadius: '50%', background: a.sw, border: 'none', cursor: 'pointer', boxShadow: isActive ? '0 0 0 2px var(--bg), 0 0 0 4px var(--accent)' : 'inset 0 0 0 1px oklch(0 0 0 / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{isActive && <Icon name="check" size={15} stroke={3} style={{ color: a.on }} />}</button>;
            })}
          </div>
        </FieldRow>
        <FieldRow label="Typeface"><Segmented value={theme.font} options={Object.entries(FONTS).map(([k, f]) => ({ value: k, label: f.label }))} onChange={v => setTweak('font', v)} /></FieldRow>
        <FieldRow label="Corners"><Segmented value={theme.radius} options={['sharp', 'soft', 'round']} onChange={v => setTweak('radius', v)} /></FieldRow>
        <FieldRow label="Density"><Segmented value={theme.density} options={['compact', 'regular', 'comfy']} onChange={v => setTweak('density', v)} /></FieldRow>
        <FieldRow label="Card style"><Segmented value={theme.card} options={['flat', 'outline', 'elevated', 'glass']} onChange={v => setTweak('card', v)} /></FieldRow>
      </SCard>

      {/* Security */}
      <SCard title="Security">
        <SettingRow icon="shield" label="Two-factor authentication" desc="Extra layer for sign-in & payments" right={<Toggle on={sec.twoFA} onChange={() => tg('twoFA')} />} last />
      </SCard>

      {/* Notifications */}
      <SCard title="Notifications">
        <SettingRow icon="bell" label="Push notifications" desc="Payments, requests & alerts" right={<Toggle on={sec.push} onChange={() => tg('push')} />} />
        <SettingRow icon="send" label="Email summaries" desc="Weekly spending digest" right={<Toggle on={sec.email} onChange={() => tg('email')} />} />
        <SettingRow icon="sparkle" label="Product & offers" desc="News and promotions" right={<Toggle on={sec.marketing} onChange={() => tg('marketing')} />} last />
      </SCard>

      {/* Plan */}
      <SCard title="Plan & billing">
        {(() => {
          const planKey = (data.user.plan || '').replace('FinVault ', '');
          const PRICES: Record<string, string> = { 'Standard': 'Free forever', 'Metal': '€9.99 / month', 'Metal+': '€16.99 / month' };
          const planDesc = PRICES[planKey] ?? '€9.99 / month';
          const isUpgradeable = planKey !== 'Metal+';
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '6px 4px' }}>
              <span style={{ width: 44, height: 44, borderRadius: 'var(--r)', background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="sparkle" size={20} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{data.user.plan}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '0.82rem' }}>{planDesc}</div>
              </div>
              <button className="btn btn-primary" onClick={openUpgrade}>{isUpgradeable ? 'Upgrade' : 'Manage plan'}</button>
            </div>
          );
        })()}
      </SCard>

      <button onClick={onLogout} className="btn btn-ghost btn-block" style={{ color: 'var(--neg)', borderColor: 'var(--line)' }}><Icon name="logout" size={18} /> Sign out</button>
      <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: '0.78rem', paddingBottom: 8 }}>FinVault · v2.0 · PSD2 licensed · ISO 27001</div>
    </div>
  );
}
