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
      <PageHead title="Notifications" back={compact ? () => navigate('overview') : undefined}
        action={unread > 0 ? <button className="btn btn--ghost" style={{ fontSize: '0.84rem', color: 'var(--accent)' }} onClick={markAllRead}>Mark all read ({unread})</button> : undefined}
      />

      {notifications.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 'var(--r)', background: 'var(--surface-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Icon name="bell" size={26} />
          </div>
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-2)', marginBottom: 4 }}>All caught up</div>
          <div style={{ fontSize: '0.84rem' }}>No notifications to show</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {notifications.map(n => (
            <div key={n.id} className="card" onClick={() => !n.read && markRead(n.id)}
              style={{ padding: '14px 20px', cursor: !n.read ? 'pointer' : 'default', display: 'flex', alignItems: 'flex-start', gap: 14, transition: 'background 0.15s', borderLeft: !n.read ? '3px solid var(--accent)' : '3px solid transparent' }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: !n.read ? 'color-mix(in oklab, var(--accent) 12%, transparent)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <Icon name="bell" size={16} style={{ color: !n.read ? 'var(--accent)' : 'var(--text-3)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: !n.read ? 700 : 500, fontSize: '0.92rem' }}>{n.title}</div>
                <div style={{ color: 'var(--text-3)', fontSize: '0.82rem', marginTop: 3, lineHeight: 1.4 }}>{n.body}</div>
              </div>
              <span style={{ color: 'var(--text-3)', fontSize: '0.72rem', flexShrink: 0, marginTop: 2 }}>
                {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
