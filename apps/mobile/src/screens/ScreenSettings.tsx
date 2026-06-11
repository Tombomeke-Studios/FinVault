import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { Icon } from '../components/Icon';
import { Avatar, relTime } from '../components/UI';
import { MobileSheet } from '../components/MobileExtras';
import { THEME, themedSheet, ACCENTS } from '../theme';
import type { AppData, ThemeConfig } from '../../App';

interface SettingsProps {
  data: AppData;
  theme: ThemeConfig;
  setTheme: (t: ThemeConfig) => void;
  onLogout: () => void;
  fire: (t: string, b: string, type?: string) => void;
  openUpgrade?: () => void;
  token?: string | null;
  apiUrl?: string;
}

interface AuditEntry {
  id: string;
  action: string;
  ipAddress?: string;
  timestamp: string;
}

// Demo-mode fallback so the screen works offline.
const MOCK_AUDIT: AuditEntry[] = [
  { id: 'a1', action: 'User login successful', ipAddress: '192.168.0.12', timestamp: new Date(Date.now() - 3600e3).toISOString() },
  { id: 'a2', action: 'Session refreshed (token rotation)', ipAddress: '192.168.0.12', timestamp: new Date(Date.now() - 26 * 3600e3).toISOString() },
  { id: 'a3', action: 'Card controls updated', ipAddress: '192.168.0.12', timestamp: new Date(Date.now() - 2 * 86400e3).toISOString() },
  { id: 'a4', action: 'Failed login attempt 1/10', ipAddress: '84.198.33.7', timestamp: new Date(Date.now() - 3 * 86400e3).toISOString() },
  { id: 'a5', action: 'Account registration completed', ipAddress: '192.168.0.12', timestamp: new Date(Date.now() - 30 * 86400e3).toISOString() },
];

function auditIcon(action: string): { icon: string; color: string } {
  const a = action.toLowerCase();
  if (a.includes('failed') || a.includes('frozen') || a.includes('blocked')) return { icon: 'alertTriangle', color: THEME.colors.warn };
  if (a.includes('signed out') || a.includes('revoked')) return { icon: 'logout', color: THEME.colors.text2 };
  if (a.includes('refresh')) return { icon: 'repeat', color: '#60a5fa' };
  if (a.includes('login')) return { icon: 'lock', color: THEME.colors.accent };
  return { icon: 'shield', color: THEME.colors.text2 };
}

// Mirrors the web PRESETS in apps/web-dashboard/src/theme.ts — mobile applies
// mode + accent; the other axes are reserved for future parity.
const PRESETS: Record<string, ThemeConfig> = {
  Vault:    { mode: 'dark',  accent: 'emerald', font: 'grotesk',   radius: 'soft',  density: 'regular', card: 'elevated' },
  Daylight: { mode: 'light', accent: 'indigo',  font: 'grotesk',   radius: 'soft',  density: 'regular', card: 'outline' },
  Aurora:   { mode: 'dark',  accent: 'violet',  font: 'bricolage', radius: 'round', density: 'comfy',   card: 'glass' },
  Carbon:   { mode: 'dark',  accent: 'azure',   font: 'mono',      radius: 'sharp', density: 'compact', card: 'outline' },
  Sand:     { mode: 'light', accent: 'amber',   font: 'editorial', radius: 'round', density: 'comfy',   card: 'elevated' },
  Midnight: { mode: 'dark',  accent: 'rose',    font: 'grotesk',   radius: 'round', density: 'regular', card: 'glass' },
  Mint:     { mode: 'light', accent: 'emerald', font: 'grotesk',   radius: 'soft',  density: 'regular', card: 'elevated' },
};

export function ScreenSettings({ data, theme, setTheme, onLogout, fire, openUpgrade, token, apiUrl }: SettingsProps) {
  const [biometric, setBiometric] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const openSecurityActivity = async () => {
    setSecurityOpen(true);
    if (!token || token === 'mock-token') {
      setLogs(MOCK_AUDIT);
      return;
    }
    setLogsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/users/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLogs(res.ok ? await res.json() : MOCK_AUDIT);
    } catch {
      setLogs(MOCK_AUDIT);
    } finally {
      setLogsLoading(false);
    }
  };

  const selectPreset = (name: string, p: ThemeConfig) => {
    setTheme(p);
    fire('Theme updated', `Theme preset changed to ${name}!`, 'success');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Customize your vault and profile.</Text>
      </View>

      {/* User Card */}
      <View style={[styles.card, styles.profileCard]}>
        <Avatar initials={data.user.initials} size={54} />
        <View style={styles.profileMeta}>
          <Text style={styles.profileName}>{data.user.firstName} {data.user.lastName}</Text>
          <Text style={styles.profileEmail}>{data.user.email}</Text>
          <Text style={styles.profilePlan}>{data.user.plan} · Since {data.user.memberSince}</Text>
        </View>
      </View>

      {/* Membership Upgrade Card */}
      <TouchableOpacity style={[styles.card, styles.upgradeCard]} onPress={openUpgrade} activeOpacity={0.85}>
        <View style={styles.upgradeLeft}>
          <Icon name="shield" size={20} color={THEME.colors.accent} />
          <View>
            <Text style={styles.upgradePlan}>{data.user.plan}</Text>
            <Text style={styles.upgradeHint}>Tap to view or change your plan</Text>
          </View>
        </View>
        <Icon name="chevRight" size={16} color={THEME.colors.accent} />
      </TouchableOpacity>

      {/* Theme Presets */}
      <View style={[styles.card, styles.sectionCard]}>
        <Text style={styles.sectionTitle}>Theme Preset</Text>
        <View style={styles.presetsGrid}>
          {Object.entries(PRESETS).map(([name, p]) => {
            const active = theme.mode === p.mode && theme.accent === p.accent && theme.font === p.font;
            return (
              <TouchableOpacity key={name} onPress={() => selectPreset(name, p)} style={[
                styles.presetBtn,
                active ? styles.presetActive : null
              ]}>
                <View style={[styles.presetSwatch, { backgroundColor: p.mode === 'dark' ? '#1f1f28' : '#fff' }]}>
                  <View style={[styles.presetIndicator, { backgroundColor: (ACCENTS[p.accent] || ACCENTS.emerald)[p.mode === 'light' ? 'light' : 'dark'] }]} />
                </View>
                <Text style={[styles.presetText, active ? styles.presetTextActive : null]}>{name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Appearance: mode + accent */}
      <View style={[styles.card, styles.sectionCard]}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {(['dark', 'light'] as const).map(m => {
            const active = theme.mode === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => setTheme({ ...theme, mode: m })}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={{ flex: 1, paddingVertical: 11, borderRadius: THEME.radius.regular, alignItems: 'center', backgroundColor: active ? THEME.colors.accentSoft : THEME.colors.surface2, borderWidth: 1, borderColor: active ? THEME.colors.accentLine : THEME.colors.line }}
              >
                <Text style={{ color: active ? THEME.colors.accent : THEME.colors.text2, fontWeight: '700', fontSize: 13, textTransform: 'capitalize' }}>{m}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(ACCENTS).map(([name, a]) => {
            const active = theme.accent === name;
            const hex = a[theme.mode === 'light' ? 'light' : 'dark'];
            return (
              <TouchableOpacity
                key={name}
                onPress={() => setTheme({ ...theme, accent: name })}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityLabel={`${name} accent`}
                accessibilityState={{ selected: active }}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: hex, alignItems: 'center', justifyContent: 'center', borderWidth: active ? 2 : 0, borderColor: THEME.colors.text }}
              >
                {active && <Icon name="check" size={15} color={theme.mode === 'light' ? '#ffffff' : '#0a0a0f'} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Custom options */}
      <View style={[styles.card, styles.sectionCard]}>
        <Text style={styles.sectionTitle}>Vault Settings</Text>
        
        <View style={styles.optionRow}>
          <View style={styles.optionInfo}>
            <Icon name="lock" size={16} color={THEME.colors.text2} />
            <Text style={styles.optionText}>Biometric sign-in (Face ID)</Text>
          </View>
          <Switch
            value={biometric}
            onValueChange={v => { setBiometric(v); fire(v ? 'Biometrics enabled' : 'Biometrics disabled', v ? 'Face ID will be used at sign-in.' : 'You will sign in with your password.', 'success'); }}
            trackColor={{ false: THEME.colors.surfaceHi, true: THEME.colors.accent }}
            thumbColor="#fff"
            accessibilityLabel="Biometric sign-in"
          />
        </View>

        <View style={styles.optionRow}>
          <View style={styles.optionInfo}>
            <Icon name="bell" size={16} color={THEME.colors.text2} />
            <Text style={styles.optionText}>Push transaction notifications</Text>
          </View>
          <Switch
            value={pushNotifs}
            onValueChange={v => { setPushNotifs(v); fire(v ? 'Notifications on' : 'Notifications off', v ? 'You will be notified about every transaction.' : 'Transaction notifications muted.', 'success'); }}
            trackColor={{ false: THEME.colors.surfaceHi, true: THEME.colors.accent }}
            thumbColor="#fff"
            accessibilityLabel="Push transaction notifications"
          />
        </View>

        <TouchableOpacity
          style={styles.optionRow}
          onPress={openSecurityActivity}
          accessibilityRole="button"
          accessibilityLabel="View security activity"
        >
          <View style={styles.optionInfo}>
            <Icon name="clock" size={16} color={THEME.colors.text2} />
            <Text style={styles.optionText}>Security activity</Text>
          </View>
          <Icon name="chevRight" size={16} color={THEME.colors.text3} />
        </TouchableOpacity>

        <View style={[styles.optionRow, { borderBottomWidth: 0 }]}>
          <View style={styles.optionInfo}>
            <Icon name="shield" size={16} color={THEME.colors.accent} />
            <Text style={styles.optionText}>Deposits protected · ISO 27001 certified</Text>
          </View>
        </View>
      </View>

      {/* Security activity sheet */}
      <MobileSheet open={securityOpen} onClose={() => setSecurityOpen(false)} title="Security activity">
        <View style={{ gap: 4, paddingBottom: 8 }}>
          <Text style={styles.securityDesc}>
            Recent sign-ins and account events. Contact support if you see anything you don't recognise.
          </Text>
          {logsLoading && <ActivityIndicator color={THEME.colors.accent} style={{ paddingVertical: 24 }} />}
          {!logsLoading && logs.map((log, i) => {
            const meta = auditIcon(log.action);
            return (
              <View key={log.id} style={[styles.auditRow, i === 0 && { borderTopWidth: 0 }]}>
                <View style={[styles.auditIcon, { backgroundColor: `${meta.color}1f` }]}>
                  <Icon name={meta.icon} size={15} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.auditAction} numberOfLines={2}>{log.action}</Text>
                  <Text style={styles.auditMeta}>
                    {relTime(new Date(log.timestamp).getTime())}{log.ipAddress ? ` · ${log.ipAddress}` : ''}
                  </Text>
                </View>
              </View>
            );
          })}
          {!logsLoading && logs.length === 0 && (
            <Text style={styles.securityDesc}>No recorded activity yet.</Text>
          )}
        </View>
      </MobileSheet>

      {/* Logout button */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={onLogout}
        accessibilityRole="button"
        accessibilityLabel="Sign out of FinVault"
      >
        <Icon name="logout" size={16} color={THEME.colors.neg} />
        <Text style={styles.logoutText}>Sign out of FinVault</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = themedSheet(() => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 88,
  },
  header: {
    paddingBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: THEME.colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.text3,
    marginTop: 2,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  profileCard: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profileMeta: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.colors.text,
  },
  profileEmail: {
    fontSize: 13.5,
    color: THEME.colors.text3,
    marginTop: 2,
  },
  profilePlan: {
    fontSize: 12,
    color: THEME.colors.accent,
    fontWeight: '600',
    marginTop: 4,
  },
  sectionCard: {
    padding: 16,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: THEME.colors.text,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.line,
    paddingBottom: 8,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetBtn: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: THEME.colors.surface2,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.regular,
    padding: 10,
    alignItems: 'center',
    gap: 8,
  },
  presetActive: {
    borderColor: THEME.colors.accentLine,
    backgroundColor: THEME.colors.accentSoft,
  },
  presetSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.colors.line2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  presetIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  presetText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: THEME.colors.text3,
  },
  presetTextActive: {
    color: THEME.colors.accent,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.line,
  },
  optionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 14,
    color: THEME.colors.text2,
  },
  securityDesc: {
    fontSize: 13,
    color: THEME.colors.text2,
    lineHeight: 19,
    marginBottom: 8,
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.line,
  },
  auditIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  auditAction: {
    fontSize: 13.5,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  auditMeta: {
    fontSize: 11.5,
    color: THEME.colors.text3,
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: THEME.colors.surface,
    borderColor: THEME.colors.line,
    borderWidth: 1,
    borderRadius: THEME.radius.regular,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  logoutText: {
    color: THEME.colors.neg,
    fontSize: 15,
    fontWeight: 'bold',
  },
  upgradeCard: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: THEME.colors.accent,
    backgroundColor: THEME.colors.accentSoft,
    elevation: 4,
    shadowColor: THEME.colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  upgradeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upgradePlan: {
    fontSize: 15,
    fontWeight: 'bold',
    color: THEME.colors.text,
  },
  upgradeHint: {
    fontSize: 12,
    color: THEME.colors.text3,
    marginTop: 2,
  },
}));
