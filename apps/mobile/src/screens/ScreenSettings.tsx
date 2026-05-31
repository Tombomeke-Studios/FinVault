import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/UI';
import { THEME } from '../theme';
import type { AppData, ThemeConfig } from '../../App';

interface SettingsProps {
  data: AppData;
  theme: ThemeConfig;
  setTheme: (t: ThemeConfig) => void;
  onLogout: () => void;
  fire: (t: string, b: string, type?: string) => void;
}

const PRESETS: Record<string, ThemeConfig> = {
  Vault:    { mode: 'dark',  accent: 'emerald', font: 'grotesk',   radius: 'soft',  density: 'regular', card: 'elevated' },
  Daylight: { mode: 'light', accent: 'indigo',  font: 'grotesk',   radius: 'soft',  density: 'regular', card: 'outline' },
  Aurora:   { mode: 'dark',  accent: 'violet',  font: 'bricolage', radius: 'round', density: 'comfy',   card: 'glass' },
  Carbon:   { mode: 'dark',  accent: 'azure',   font: 'mono',      radius: 'sharp', density: 'compact', card: 'outline' },
  Sand:     { mode: 'light', accent: 'amber',   font: 'editorial', radius: 'round', density: 'comfy',   card: 'elevated' },
};

export function ScreenSettings({ data, theme, setTheme, onLogout, fire }: SettingsProps) {
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
                  <View style={[styles.presetIndicator, { backgroundColor: p.accent === 'emerald' ? '#10b981' : p.accent === 'indigo' ? '#6366f1' : p.accent === 'violet' ? '#8b5cf6' : p.accent === 'azure' ? '#06b6d4' : '#f59e0b' }]} />
                </View>
                <Text style={[styles.presetText, active ? styles.presetTextActive : null]}>{name}</Text>
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
            <Text style={styles.optionText}>Secure Login biometric authentication</Text>
          </View>
          <Icon name="chevRight" size={16} color={THEME.colors.text3} />
        </View>

        <View style={styles.optionRow}>
          <View style={styles.optionInfo}>
            <Icon name="bell" size={16} color={THEME.colors.text2} />
            <Text style={styles.optionText}>Push transaction notifications</Text>
          </View>
          <Icon name="chevRight" size={16} color={THEME.colors.text3} />
        </View>

        <View style={styles.optionRow}>
          <View style={styles.optionInfo}>
            <Icon name="shield" size={16} color={THEME.colors.text2} />
            <Text style={styles.optionText}>ISO 27001 deposits certification</Text>
          </View>
          <Icon name="chevRight" size={16} color={THEME.colors.text3} />
        </View>
      </View>

      {/* Logout button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <Icon name="logout" size={16} color={THEME.colors.neg} />
        <Text style={styles.logoutText}>Sign out of FinVault</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
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
});
