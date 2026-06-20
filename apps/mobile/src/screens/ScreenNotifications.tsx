import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from '../components/Icon';
import { FadeSlideIn } from '../components/Motion';
import { THEME, themedSheet } from '../theme';

interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

interface Props {
  token: string | null;
  apiUrl: string;
  fire: (t: string, b: string, type?: string) => void;
  onBack: () => void;
}

export function ScreenNotifications({ token, apiUrl, fire, onBack }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/api/notifications`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setNotifications(await res.json());
    } catch { /* offline */ }
  }, [token, apiUrl]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markRead = async (id: string) => {
    try {
      await fetch(`${apiUrl}/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    try {
      await fetch(`${apiUrl}/api/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      fire('Done', 'All notifications marked as read.', 'success');
    } catch { fire('Error', 'Failed to mark all as read.', 'error'); }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 88 }}>
      <FadeSlideIn delay={0}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="arrowLeft" size={22} color={THEME.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead}>
              <Text style={{ color: THEME.colors.accent, fontSize: 13, fontWeight: '600' }}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </FadeSlideIn>

      {notifications.length === 0 ? (
        <FadeSlideIn delay={80}>
          <View style={styles.emptyCard}>
            <Icon name="bell" size={32} color={THEME.colors.text3} />
            <Text style={styles.emptyText}>No notifications</Text>
          </View>
        </FadeSlideIn>
      ) : (
        notifications.map((n, i) => (
          <FadeSlideIn key={n.id} delay={i * 40}>
            <TouchableOpacity
              style={[styles.card, !n.read && { borderLeftWidth: 3, borderLeftColor: THEME.colors.accent }]}
              onPress={() => !n.read && markRead(n.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.cardTitle}>{n.title}</Text>
              <Text style={styles.cardBody}>{n.body}</Text>
              <Text style={styles.cardTime}>{new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
            </TouchableOpacity>
          </FadeSlideIn>
        ))
      )}
    </ScrollView>
  );
}

const styles = themedSheet(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg, paddingHorizontal: 16, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: THEME.colors.text, flex: 1 },
  emptyCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.regular, padding: 32, alignItems: 'center', gap: 12 },
  emptyText: { color: THEME.colors.text3, fontSize: 14 },
  card: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.regular, padding: 16, marginBottom: 8 },
  cardTitle: { color: THEME.colors.text, fontWeight: '600', fontSize: 15 },
  cardBody: { color: THEME.colors.text2, fontSize: 13, marginTop: 4 },
  cardTime: { color: THEME.colors.text3, fontSize: 11, marginTop: 6 },
}));
