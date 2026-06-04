import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './Icon';
import { Avatar, Sheet, Toast } from './UI';
import type { ToastData } from '../App';

// ---- Logo ----
export function FVLogo({ size = 28 }: { size?: number }) {
  return (
    <img
      src="/logo-lockup.png"
      alt="FinVault"
      style={{ height: size * 1.1, width: 'auto', display: 'block', objectFit: 'contain' }}
    />
  );
}

// ---- Nav items ----
const NAV = [
  { id: 'overview',     label: 'Home',     icon: 'home'       },
  { id: 'transactions', label: 'Activity', icon: 'list'       },
  { id: 'transfer',     label: 'Money',    icon: 'send'       },
  { id: 'cards',        label: 'Cards',    icon: 'card'       },
  { id: 'analytics',    label: 'Insights', icon: 'chart'      },
  { id: 'savings',      label: 'Goals',    icon: 'targetRing' },
];
const BOTTOM = ['overview', 'transactions', 'transfer', 'cards', 'savings'];

// ---- Notification item ----
interface NotifItem { title: string; body: string; type: 'success' | 'info' | 'warning'; time: string; }

function Notifs({ open, onClose, items }: { open: boolean; onClose: () => void; items: NotifItem[] }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70 }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{ position: 'absolute', top: 64, right: 18, width: 'min(340px, calc(100% - 36px))', padding: 'var(--pad)', boxShadow: 'var(--shadow)', animation: 'fvRise .2s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 700 }}>Notifications</span>
          <button className="btn btn-quiet" onClick={onClose} style={{ padding: 4, fontSize: '0.78rem', color: 'var(--accent)' }}>Mark all read</button>
        </div>
        {items.length === 0 && <p style={{ color: 'var(--text-3)', fontSize: '0.84rem', textAlign: 'center', padding: '12px 0' }}>No new notifications</p>}
        {items.slice(0, 5).map((n, i) => (
          <div key={i} style={{ display: 'flex', gap: 11, padding: '10px 4px', borderTop: '1px solid var(--line)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, background: n.type === 'success' ? 'var(--pos)' : n.type === 'warning' ? 'var(--warn)' : 'var(--accent)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{n.title}</div>
              <div style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>{n.body}</div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-3)', flexShrink: 0 }}>{n.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Upgrade Sheet ----
function UpgradeSheet({ open, onClose, compact, fire, currentPlan, onUpgrade }: { open: boolean; onClose: () => void; compact: boolean; fire: (t: string, b: string, type?: string) => void; currentPlan?: string; onUpgrade?: (p: string) => void }) {
  const currentPlanClean = (currentPlan || '').replace('FinVault ', '');
  const [sel, setSel] = useState(currentPlanClean || 'Metal');

  const plans = [
    { name: 'Standard', price: '€0',    tag: 'Free forever', feats: ['1 free card', '€200/mo fee-free ATM', 'Instant P2P transfers', 'Basic insights'], cur: currentPlanClean === 'Standard' },
    { name: 'Metal',    price: '€9.99', tag: 'Popular plan', feats: ['3 metal & virtual cards', '€2,000/mo fee-free ATM', 'Priority support', 'Full analytics & budgets'], cur: currentPlanClean === 'Metal' },
    { name: 'Metal+',   price: '€16.99',tag: 'Best value',   feats: ['Unlimited virtual cards', 'Unlimited fee-free ATM', 'Worldwide travel insurance', '3% savings interest', 'Airport lounge access'], cur: currentPlanClean === 'Metal+', hot: true },
  ];

  return (
    <Sheet open={open} onClose={onClose} mobile={compact} title="Choose your plan">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
        {plans.map(p => {
          const active = sel === p.name;
          return (
            <div key={p.name} onClick={() => setSel(p.name)} className="card" style={{
              padding: 'var(--pad)', cursor: 'pointer', position: 'relative',
              borderColor: active ? 'var(--accent)' : 'var(--line)',
              boxShadow: active ? '0 0 0 1px var(--accent)' : 'none',
              background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="display" style={{ fontWeight: 700, fontSize: '1.05rem' }}>{p.name}</span>
                  {p.hot && <span className="chip chip-accent" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>{p.tag}</span>}
                  {p.cur && <span className="chip" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>Current Plan</span>}
                </div>
                <div className="num" style={{ fontWeight: 700 }}>{p.price}<span style={{ fontSize: '0.72rem', color: 'var(--text-3)', fontWeight: 500 }}>/mo</span></div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 10 }}>
                {p.feats.map(f => <span key={f} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', color: 'var(--text-2)' }}><Icon name="check" size={13} style={{ color: active ? 'var(--accent)' : 'var(--text-3)' }} /> {f}</span>)}
              </div>
            </div>
          );
        })}
        <button className="btn btn-primary btn-block" onClick={() => {
          onClose();
          if (onUpgrade && sel !== currentPlanClean) {
            onUpgrade(sel);
          } else {
            fire(sel === currentPlanClean ? 'Already on plan' : `Welcome to FinVault ${sel}`, sel === currentPlanClean ? `You are already subscribed to ${sel}.` : 'Your new perks are live.', 'info');
          }
        }}>
          {sel === currentPlanClean ? 'Keep current plan' : `Switch to ${sel}`}
        </button>
      </div>
    </Sheet>
  );
}

// ---- Shell ----
export interface ShellProps {
  route: string;
  setRoute: (r: string) => void;
  compact: boolean;
  children: React.ReactNode;
  onLogout: () => void;
  fire: (title: string, body: string, type?: string) => void;
  toast: ToastData | null;
  upgradeOpen: boolean;
  openUpgrade: () => void;
  closeUpgrade: () => void;
  user: { firstName: string; lastName: string; initials: string; plan: string } | null;
  notifications: NotifItem[];
  embedded?: boolean;
  onUpgrade?: (plan: string) => void;
}

export function Shell({ route, setRoute, compact, children, onLogout, fire, toast, upgradeOpen, openUpgrade, closeUpgrade, user, notifications, embedded, onUpgrade }: ShellProps) {
  const [notif, setNotif] = useState(false);
  const prevRoute = useRef(route);
  const [transDir, setTransDir] = useState<'forward' | 'back'>('forward');
  const NAV_ORDER = ['overview', 'transactions', 'transfer', 'cards', 'analytics', 'savings', 'settings'];

  useEffect(() => {
    const pi = NAV_ORDER.indexOf(prevRoute.current), ci = NAV_ORDER.indexOf(route);
    setTransDir(ci >= pi ? 'forward' : 'back');
    prevRoute.current = route;
  }, [route]);

  const unread = notifications.some(n => !(n as any).read);

  const TopBar = (
    <header style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap)', padding: compact ? `${embedded ? 46 : 14}px 18px 14px` : '18px 28px', position: 'sticky', top: 0, zIndex: 50, background: 'color-mix(in oklab, var(--bg) 82%, transparent)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)' }}>
      {compact && <FVLogo size={26} />}
      {!compact && (
        <div style={{ position: 'relative', flex: '0 1 380px' }}>
          <Icon name="search" size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input className="field" placeholder="Search anything…" aria-label="Search transactions, accounts and contacts" style={{ paddingLeft: 42, background: 'var(--surface)' }} />
        </div>
      )}
      <div style={{ flex: 1 }} />
      <button className="btn btn-ghost" style={{ padding: 11, borderRadius: 'var(--r-pill)', position: 'relative' }} onClick={() => setNotif(true)} aria-label={unread ? 'Notifications — unread alerts' : 'Notifications'}>
        <Icon name="bell" size={19} />
        {unread && <span aria-hidden="true" style={{ position: 'absolute', top: 8, right: 9, width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--surface-2)' }} />}
      </button>
      {!compact ? (
        <button onClick={() => setRoute('settings')} className="btn btn-ghost" style={{ padding: '7px 7px 7px 12px', borderRadius: 'var(--r-pill)', gap: 10, borderColor: route === 'settings' ? 'var(--accent-line)' : 'var(--line)' }}>
          <span style={{ textAlign: 'right', lineHeight: 1.1 }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, display: 'block' }}>{user?.firstName} {user?.lastName}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>{user?.plan || 'FinVault Metal'}</span>
          </span>
          <Avatar initials={user?.initials || 'FV'} hue={265} size={34} />
        </button>
      ) : (
        <button onClick={() => setRoute('settings')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, borderRadius: '50%', boxShadow: route === 'settings' ? '0 0 0 2px var(--accent)' : 'none' }} aria-label="Settings">
          <Avatar initials={user?.initials || 'FV'} hue={265} size={34} />
        </button>
      )}
    </header>
  );

  const overlays = (
    <>
      <Notifs open={notif} onClose={() => setNotif(false)} items={notifications} />
      <UpgradeSheet open={upgradeOpen} onClose={closeUpgrade} compact={compact} fire={fire} currentPlan={user?.plan} onUpgrade={onUpgrade} />
      <Toast toast={toast} embedded={embedded || compact} />
    </>
  );

  if (compact) {
    return (
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {TopBar}
        <main style={{ flex: 1, overflow: 'visible' }}>
          <div key={route} className={transDir === 'forward' ? 'slide-right' : 'slide-left'} style={{ padding: '18px 18px 96px' }}>{children}</div>
        </main>
        <nav style={{ position: 'sticky', bottom: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: embedded ? '8px 8px 26px' : '8px 8px calc(8px + env(safe-area-inset-bottom))', background: 'color-mix(in oklab, var(--bg) 88%, transparent)', backdropFilter: 'blur(14px)', borderTop: '1px solid var(--line)' }}>
          {BOTTOM.map(id => {
            const n = NAV.find(x => x.id === id)!;
            const active = route === id || (id === 'overview' && route.startsWith('account:'));
            if (id === 'transfer') return (
              <button key={id} onClick={() => setRoute(id)} style={{ border: 'none', cursor: 'pointer', width: 54, height: 54, borderRadius: 'var(--r-pill)', background: 'var(--accent)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px -6px var(--accent-line)', transform: 'translateY(-10px)' }} aria-label="Send money">
                <Icon name="send" size={24} />
              </button>
            );
            return (
              <button key={id} onClick={() => setRoute(id)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 10px', color: active ? 'var(--accent)' : 'var(--text-3)', flex: 1 }}>
                <Icon name={n.icon} size={22} stroke={active ? 2.4 : 2} />
                <span style={{ fontSize: '0.66rem', fontWeight: 600 }}>{n.label}</span>
              </button>
            );
          })}
        </nav>
        {overlays}
      </div>
    );
  }

  // ---- WEB layout ----
  const navBtn = (id: string, label: string, icon: string) => {
    const active = route === id || (id === 'overview' && route.startsWith('account:'));
    return (
      <button key={id} onClick={() => setRoute(id)} role="menuitem" aria-current={active ? 'page' : undefined}
        className={`nav-item${active ? ' active' : ''}`}>
        <Icon name={icon} size={20} stroke={active ? 2.3 : 2} />
        {label}
      </button>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '244px 1fr', minHeight: '100%', position: 'relative' }}>
      <aside style={{ borderRight: '1px solid var(--line)', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 6, position: 'sticky', top: 0, height: '100vh', background: 'var(--bg)', overflowY: 'auto' }}>
        <div style={{ padding: '4px 10px 22px' }}><FVLogo size={28} /></div>
        <nav role="menu" aria-label="Main navigation" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(n => navBtn(n.id, n.label, n.icon))}
        </nav>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(!user?.plan || user.plan === 'FinVault Standard') && (
            <div style={{ padding: '14px 16px', borderRadius: 'var(--r-lg)', background: 'linear-gradient(145deg, var(--accent-soft), color-mix(in oklab, var(--surface-2) 70%, var(--accent-soft)))', border: '1px solid var(--accent-line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="sparkle" size={14} style={{ color: 'var(--on-accent)' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Go Metal+</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>€16.99 / month</div>
                </div>
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-2)', lineHeight: 1.5 }}>Unlimited cards · Lounge access · 3% savings rate</p>
              <button className="btn btn-primary" style={{ padding: '8px', fontSize: '0.82rem' }} onClick={openUpgrade}>Upgrade plan</button>
            </div>
          )}
          {navBtn('settings', 'Settings', 'settings')}
          <button onClick={onLogout} className="nav-item" style={{ color: 'var(--text-3)', justifyContent: 'flex-start', fontFamily: 'var(--font-body)', fontSize: '0.95rem', fontWeight: 600, width: '100%' }}>
            <Icon name="logout" size={20} /> Sign out
          </button>
        </div>
      </aside>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {TopBar}
        <main style={{ flex: 1, padding: '28px clamp(20px, 3vw, 40px) 48px', maxWidth: 1180, width: '100%', margin: '0 auto' }} key={route}>{children}</main>
      </div>
      {overlays}
    </div>
  );
}
