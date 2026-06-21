import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../components/Icon';
import { PageHead } from '../components/UI';

interface Notification { id: string; title: string; body: string; read: boolean; createdAt: string; }
interface Props { compact: boolean; token: string; navigate: (r: string) => void; fire: (t: string, b: string, type?: string) => void; }

export function ScreenNotifications({ compact, token, navigate, fire }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotifications = useCallback(async () => {
    try { const res = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } }); if (res.ok) setNotifications(await res.json()); } catch {}
  }, [token]);
  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };
  const markAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    fire('Done', 'All marked as read.', 'success');
  };

  const unread = notifications.filter(n => !n.read).length;

  return (
    <div style={{ padding: compact ? 16 : 24, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <PageHead title="Notifications" back={compact ? () => navigate('overview') : undefined} />
        {unread > 0 && <button className="btn btn--ghost" style={{ marginLeft: 'auto', fontSize: '0.8rem' }} onClick={markAllRead}>Mark all read</button>}
      </div>
      {notifications.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
          <Icon name="bell" size={32} /><div style={{ marginTop: 8 }}>No notifications</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {notifications.map(n => (
            <div key={n.id} className="card" style={{ padding: 14, cursor: !n.read ? 'pointer' : 'default', borderLeft: !n.read ? '3px solid var(--accent)' : 'none' }} onClick={() => !n.read && markRead(n.id)}>
              <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{n.title}</div>
              <div style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: 4 }}>{n.body}</div>
              <div style={{ color: 'var(--text-3)', fontSize: '0.72rem', marginTop: 6 }}>{new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
