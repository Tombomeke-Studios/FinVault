import React, { useState } from 'react';
import { Icon } from '../components/Icon';
import { FVLogo } from '../components/Shell';

interface AuthProps {
  compact: boolean;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (firstName: string, lastName: string, email: string, password: string) => Promise<void>;
  authError: string;
  authSuccess: string;
}

export function ScreenAuth({ compact, onLogin, onRegister, authError, authSuccess }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('admin@finvault.com');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await onLogin(email, pw);
      } else {
        await onRegister(firstName, lastName, email, pw);
      }
    } finally {
      setLoading(false);
    }
  };

  const form = (
    <div className="card rise" style={{ width: '100%', maxWidth: 420, padding: 'var(--pad-lg)', boxShadow: 'var(--shadow)' }}>
      <div style={{ marginBottom: 'var(--gap-lg)' }}>
        {compact && (
          <div style={{ marginBottom: 20 }}>
            <FVLogo size={28} />
          </div>
        )}
        <h1 className="display" style={{ fontSize: '1.75rem', fontWeight: 700 }}>
          {mode === 'login' ? 'Welcome back' : 'Open your Vault'}
        </h1>
        <p style={{ color: 'var(--text-2)', marginTop: 6, fontSize: '0.95rem' }}>
          {mode === 'login' ? 'Sign in to your FinVault account.' : 'A few details and your IBAN is ready in seconds.'}
        </p>
      </div>

      {authError && (
        <div style={{ background: 'color-mix(in oklab, var(--neg) 14%, transparent)', border: '1px solid var(--neg)', borderRadius: 'var(--r)', padding: '10px 14px', color: 'var(--neg)', fontSize: '0.88rem', marginBottom: 'var(--gap)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="x" size={15} />{authError}
        </div>
      )}
      {authSuccess && (
        <div style={{ background: 'color-mix(in oklab, var(--pos) 14%, transparent)', border: '1px solid var(--pos)', borderRadius: 'var(--r)', padding: '10px 14px', color: 'var(--pos)', fontSize: '0.88rem', marginBottom: 'var(--gap)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="check" size={15} />{authSuccess}
        </div>
      )}

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
        {mode === 'register' && (
          <div style={{ display: 'flex', gap: 'var(--gap)' }}>
            <div style={{ flex: 1 }}><label className="label">First name</label><input className="field" value={firstName} onChange={e => setFirstName(e.target.value)} required /></div>
            <div style={{ flex: 1 }}><label className="label">Last name</label><input className="field" value={lastName} onChange={e => setLastName(e.target.value)} required /></div>
          </div>
        )}
        <div>
          <label className="label">Email</label>
          <input className="field" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@email.com" required />
        </div>
        <div>
          <label className="label">Password</label>
          <div style={{ position: 'relative' }}>
            <input className="field" type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" style={{ paddingRight: 44 }} required />
            <button type="button" onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 8 }}>
              <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
            </button>
          </div>
        </div>

        {mode === 'login' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-2)', cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} /> Keep me signed in
            </label>
            <a style={{ color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}>Forgot?</a>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 4, padding: '14px' }} disabled={loading}>
          {loading ? 'Loading…' : (mode === 'login' ? 'Sign in' : 'Create account')} <Icon name="arrowRight" size={18} />
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 'var(--gap-lg)', fontSize: '0.9rem', color: 'var(--text-2)' }}>
        {mode === 'login' ? "New to FinVault? " : 'Already have an account? '}
        <a onClick={() => setMode(mode === 'login' ? 'register' : 'login')} style={{ color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }}>
          {mode === 'login' ? 'Open an account' : 'Sign in'}
        </a>
      </p>
    </div>
  );

  if (compact) {
    return (
      <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>{form}</div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', minHeight: '100vh' }}>
      {/* Brand panel */}
      <div style={{ position: 'relative', overflow: 'hidden', padding: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(155deg, var(--accent-lo), var(--accent) 55%, var(--accent-hi))', color: 'var(--on-accent)' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.12, backgroundImage: 'radial-gradient(circle at 80% 20%, white 0 1px, transparent 1px)', backgroundSize: '26px 26px' }} />
        <div style={{ position: 'relative' }}>
          <FVLogo size={32} />
        </div>
        <div style={{ position: 'relative' }}>
          <div className="display" style={{ fontSize: '2.6rem', lineHeight: 1.05, fontWeight: 700, letterSpacing: '-0.03em' }}>
            Banking that moves at the speed of you.
          </div>
          <p style={{ marginTop: 18, fontSize: '1.05rem', opacity: 0.9, maxWidth: 380 }}>
            Multi-currency wallets, instant transfers and a real-time ledger — wrapped in a vault.
          </p>
          <div style={{ display: 'flex', gap: 24, marginTop: 32 }}>
            {[['€2.4B', 'moved monthly'], ['180+', 'countries'], ['4.9★', 'app rating']].map(([a, b]) => (
              <div key={b}><div className="display num" style={{ fontSize: '1.7rem', fontWeight: 700 }}>{a}</div><div style={{ fontSize: '0.82rem', opacity: 0.85 }}>{b}</div></div>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', fontSize: '0.82rem', opacity: 0.8 }}>Insured deposits · ISO 27001 · PSD2 licensed</div>
      </div>
      {/* Form panel */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>{form}</div>
    </div>
  );
}
