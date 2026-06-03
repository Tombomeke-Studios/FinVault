import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from './Icon';
import { Avatar } from './UI';
import { THEME } from '../theme';

interface ShellProps {
  route: string;
  setRoute: (r: string) => void;
  user: { firstName: string; lastName: string; initials: string; plan: string } | null;
  children: React.ReactNode;
}

const BOTTOM_NAV = [
  { id: 'overview',     label: 'Home',     icon: 'home'       },
  { id: 'transactions', label: 'Activity', icon: 'list'       },
  { id: 'transfer',     label: 'Send',     icon: 'send'       },
  { id: 'analytics',   label: 'Insights', icon: 'chart'      },
  { id: 'savings',      label: 'Goals',    icon: 'targetRing' },
];

export function Shell({ route, setRoute, user, children }: ShellProps) {
  return (
    <View style={styles.container}>
      {/* Top sticky bar */}
      <View style={styles.topBar}>
        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <Icon name="shield" size={14} color={THEME.colors.onAccent} />
          </View>
          <Text style={styles.logoText}>FinVault</Text>
        </View>
        <View style={styles.topRight}>
          <TouchableOpacity
            style={styles.topBtn}
            onPress={() => setRoute('settings')}
            accessibilityLabel="Open settings"
            accessibilityRole="button"
          >
            <Avatar initials={user?.initials || 'FV'} size={32} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Screen Content */}
      <View style={styles.content}>
        {children}
      </View>

      {/* Bottom sticky navigation row */}
      <View style={styles.navBar}>
        {BOTTOM_NAV.map(nav => {
          const active = route === nav.id;

          if (nav.id === 'transfer') {
            return (
              <TouchableOpacity
                key={nav.id}
                onPress={() => setRoute(nav.id)}
                style={styles.floatingBtn}
                activeOpacity={0.85}
                accessibilityLabel="Send money"
                accessibilityRole="button"
              >
                <Icon name="send" size={22} color={THEME.colors.onAccent} />
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={nav.id}
              onPress={() => setRoute(nav.id)}
              style={styles.navItem}
              activeOpacity={0.7}
              accessibilityLabel={nav.label}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.navIconWrap, active && styles.navIconWrapActive]}>
                <Icon
                  name={nav.icon}
                  size={21}
                  color={active ? THEME.colors.accent : THEME.colors.text3}
                />
              </View>
              <Text style={[styles.navText, { color: active ? THEME.colors.accent : THEME.colors.text3 }]}>
                {nav.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.line,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: THEME.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.colors.text,
    letterSpacing: -0.5,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topBtn: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  navBar: {
    height: 64,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: THEME.colors.line,
    backgroundColor: THEME.colors.surface,
    paddingBottom: 4,
    position: 'relative',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    flex: 1,
    gap: 3,
  },
  navIconWrap: {
    width: 40,
    height: 28,
    borderRadius: THEME.radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navIconWrapActive: {
    backgroundColor: THEME.colors.accentSoft,
  },
  navText: {
    fontSize: 11,
    fontWeight: '600',
  },
  floatingBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: THEME.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    transform: [{ translateY: -14 }],
  },
});
