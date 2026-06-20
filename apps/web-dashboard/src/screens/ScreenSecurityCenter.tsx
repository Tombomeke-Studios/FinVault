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
  const [currentPw, setCurrentPw] = useState(''); const [newPw, setNewPw] = useState(''); const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    try { const res = await fetch('/api/users/sessions', { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setSessions(await res.json()); } catch {}
  }, [token]);
  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const changePassword = async () => {
    if (!currentPw || !newPw) return;
    if (newPw.length < 8) { fire('Error', 'Min 8 characters.', 'error'); return; }
    if (newPw !== confirmPw) { fire('Error', 'Passwords don\'t match.', 'error'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/users/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }) });
      if (res.ok) { const d = await res.json(); fire('Changed', 'All other sessions revoked.', 'success'); setPwOpen(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); onPasswordChanged(d.accessToken, d.refreshToken); fetchSessions(); }
      else { const e = await res.json(); fire('Error', e.error || 'Failed.', 'error'); }
    } catch { fire('Error', 'Failed.', 'error'); }
    setLoading(false);
  };

  const revoke = async (id: string) => {
    await fetch(`/api/users/sessions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    fire('Revoked', 'Session terminated.', 'success'); fetchSessions();
  };

  return (
    <div style={{ padding: compact ? 16 : 24, maxWidth: 720, margin: '0 auto' }}>
      <PageHead title="Security Center" back={() => navigate('settings')} />
      <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', marginBottom: 16 }} onClick={() => setPwOpen(true)}>
        <span style={{ width: 40, height: 40, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="lock" size={18} /></span>
        <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>Change Password</div><div style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>Update your account password</div></div>
        <Icon name="chevron-right" size={16} style={{ color: 'var(--text-3)' }} />
      </div>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Active Sessions ({sessions.length})</div>
      {sessions.map(s => (
        <div key={s.id} className="card" style={{ padding: 14, display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Session</div><div style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>Expires {new Date(s.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div></div>
          <button className="btn btn--ghost" style={{ color: '#fb7185', fontSize: '0.78rem' }} onClick={() => revoke(s.id)}>Revoke</button>
        </div>
      ))}
      <Sheet open={pwOpen} onClose={() => setPwOpen(false)} title="Change Password">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input className="field" type="password" placeholder="Current password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
          <input className="field" type="password" placeholder="New password (min 8 chars)" value={newPw} onChange={e => setNewPw(e.target.value)} />
          <input className="field" type="password" placeholder="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
          <button className="btn" onClick={changePassword} disabled={loading}>{loading ? 'Changing...' : 'Change Password'}</button>
        </div>
      </Sheet>
    </div>
  );
}
