import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../components/Icon';
import { Sheet, PageHead } from '../components/UI';

interface Session { id: string; expiresAt: string; }
interface Props {
  compact: boolean; token: string; navigate: (r: string) => void;
  fire: (t: string, b: string, type?: string) => void;
  onPasswordChanged: (at: string, rt: string) => void;
}

export function ScreenSecurityCenter({ compact, token, navigate, fire, onPasswordChanged }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFAOpen, setTwoFAOpen] = useState(false);
  const [twoFASetup, setTwoFASetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);

  const fetch2FAStatus = useCallback(async () => {
    try { const res = await fetch('/api/users/2fa/status', { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) { const d = await res.json(); setTwoFAEnabled(d.enabled); } } catch {}
  }, [token]);

  const fetchSessions = useCallback(async () => {
    try { const res = await fetch('/api/users/sessions', { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setSessions(await res.json()); } catch {}
  }, [token]);
  useEffect(() => { fetchSessions(); fetch2FAStatus(); }, [fetchSessions, fetch2FAStatus]);

  const changePassword = async () => {
    if (!currentPw || !newPw) return;
    if (newPw.length < 8) { fire('Error', 'New password must be at least 8 characters.', 'error'); return; }
    if (newPw !== confirmPw) { fire('Error', 'Passwords do not match.', 'error'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/users/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }) });
      if (res.ok) { const d = await res.json(); fire('Password changed', 'All other sessions have been revoked.', 'success'); setPwOpen(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); onPasswordChanged(d.accessToken, d.refreshToken); fetchSessions(); }
      else { const e = await res.json(); fire('Error', e.error || 'Failed to change password.', 'error'); }
    } catch { fire('Error', 'Failed to change password.', 'error'); }
    setLoading(false);
  };

  const revoke = async (id: string) => {
    await fetch(`/api/users/sessions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fire('Session revoked', 'The session has been terminated.', 'success'); fetchSessions();
  };

  const canSubmit = currentPw && newPw && newPw.length >= 8 && newPw === confirmPw;

  return (
    <div style={{ padding: compact ? 16 : 24, maxWidth: 760, margin: '0 auto' }}>
      <PageHead title="Security Center" back={compact ? () => navigate('overview') : undefined} />

      {/* Action cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }} onClick={() => setPwOpen(true)}>
          <div style={{ width: 46, height: 46, borderRadius: 'var(--r)', background: 'color-mix(in oklab, var(--accent) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="lock" size={22} style={{ color: 'var(--accent)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Change Password</div>
            <div style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: 2 }}>Update your account password and revoke all sessions</div>
          </div>
          <Icon name="chevron-right" size={16} style={{ color: 'var(--text-3)' }} />
        </div>

        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }} onClick={async () => {
          if (twoFAEnabled) { setTwoFAOpen(true); } else {
            try { const res = await fetch('/api/users/2fa/setup', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); if (res.ok) { setTwoFASetup(await res.json()); setTwoFAOpen(true); } } catch { fire('Error', 'Failed to setup 2FA', 'error'); }
          }
        }}>
          <div style={{ width: 46, height: 46, borderRadius: 'var(--r)', background: twoFAEnabled ? 'color-mix(in oklab, #34d399 12%, transparent)' : 'color-mix(in oklab, var(--accent) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="shield" size={22} style={{ color: twoFAEnabled ? '#34d399' : 'var(--accent)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Two-Factor Authentication</div>
            <div style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: 2 }}>{twoFAEnabled ? 'Enabled — click to disable' : 'Protect your account with TOTP'}</div>
          </div>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: twoFAEnabled ? '#34d399' : 'var(--text-3)', background: twoFAEnabled ? 'color-mix(in oklab, #34d399 12%, transparent)' : 'var(--surface-2)', padding: '4px 10px', borderRadius: 'var(--r-pill)' }}>{twoFAEnabled ? 'ON' : 'OFF'}</span>
        </div>
      </div>

      {/* Active sessions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="eyebrow">Active Sessions</div>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-3)', fontWeight: 600 }}>{sessions.length} active</span>
      </div>

      {sessions.length === 0 ? (
        <div className="card" style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
          <Icon name="lock" size={24} />
          <div style={{ marginTop: 8, fontSize: '0.88rem' }}>No active sessions</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sessions.map((s, i) => (
            <div key={s.id} className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: i === 0 ? 'color-mix(in oklab, var(--accent) 12%, transparent)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={i === 0 ? 'smartphone' : 'monitor'} size={16} style={{ color: i === 0 ? 'var(--accent)' : 'var(--text-3)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Session
                  {i === 0 && <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '2px 8px', borderRadius: 'var(--r-pill)' }}>CURRENT</span>}
                </div>
                <div style={{ color: 'var(--text-3)', fontSize: '0.78rem', marginTop: 2 }}>
                  Expires {new Date(s.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <button className="btn btn-ghost" style={{ color: '#fb7185', fontSize: '0.78rem', padding: '6px 12px' }} onClick={() => revoke(s.id)}>Revoke</button>
            </div>
          ))}
        </div>
      )}

      {/* Change password sheet */}
      <Sheet open={pwOpen} onClose={() => setPwOpen(false)} title="Change Password">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>Current password</label>
            <input className="field" type="password" placeholder="Enter current password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>New password</label>
            <input className="field" type="password" placeholder="Minimum 8 characters" value={newPw} onChange={e => setNewPw(e.target.value)} />
            {newPw && newPw.length < 8 && <div style={{ color: '#fb7185', fontSize: '0.78rem', marginTop: 4 }}>Must be at least 8 characters</div>}
          </div>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>Confirm new password</label>
            <input className="field" type="password" placeholder="Re-enter new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
            {confirmPw && newPw !== confirmPw && <div style={{ color: '#fb7185', fontSize: '0.78rem', marginTop: 4 }}>Passwords do not match</div>}
          </div>
          <button className="btn btn-primary" onClick={changePassword} disabled={loading || !canSubmit} style={{ marginTop: 4, opacity: canSubmit ? 1 : 0.5 }}>
            {loading ? 'Changing…' : 'Change Password'}
          </button>
        </div>
      </Sheet>

      {/* 2FA setup/disable sheet */}
      <Sheet open={twoFAOpen} onClose={() => { setTwoFAOpen(false); setTwoFACode(''); }} mobile={compact} title={twoFAEnabled ? 'Disable 2FA' : 'Enable 2FA'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
          {!twoFAEnabled && twoFASetup && (
            <>
              <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', textAlign: 'center', lineHeight: 1.5 }}>Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
              {twoFASetup.qrDataUrl && <img src={twoFASetup.qrDataUrl} alt="2FA QR Code" style={{ width: 180, height: 180, borderRadius: 'var(--r)' }} />}
              <div style={{ background: 'var(--surface-2)', padding: '10px 16px', borderRadius: 'var(--r)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: 4 }}>Or enter manually:</div>
                <code style={{ fontSize: '0.92rem', fontWeight: 700, letterSpacing: '0.1em', userSelect: 'all' }}>{twoFASetup.secret}</code>
              </div>
            </>
          )}
          {twoFAEnabled && <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', textAlign: 'center' }}>Enter your 6-digit authenticator code to disable 2FA</p>}
          <input className="field" value={twoFACode} onChange={e => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" maxLength={6} style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.3em', width: '100%' }} autoFocus />
          <button className="btn btn-primary" style={{ width: '100%', opacity: twoFACode.length === 6 ? 1 : 0.5 }} disabled={twoFALoading || twoFACode.length !== 6} onClick={async () => {
            setTwoFALoading(true);
            try {
              const endpoint = twoFAEnabled ? '/api/users/2fa/disable' : '/api/users/2fa/verify';
              const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ code: twoFACode }) });
              if (res.ok) { fire(twoFAEnabled ? '2FA disabled' : '2FA enabled', twoFAEnabled ? 'Two-factor authentication has been turned off.' : 'Your account is now protected with 2FA.', 'success'); setTwoFAEnabled(!twoFAEnabled); setTwoFAOpen(false); setTwoFACode(''); setTwoFASetup(null); }
              else { const e = await res.json(); fire('Error', e.error || 'Invalid code', 'error'); }
            } catch { fire('Error', 'Verification failed', 'error'); }
            setTwoFALoading(false);
          }}>{twoFALoading ? 'Verifying…' : twoFAEnabled ? 'Disable 2FA' : 'Enable 2FA'}</button>
        </div>
      </Sheet>
    </div>
  );
}
