import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from './Icon';
import { Avatar } from './UI';
import { FVLogo } from './FVLogo';
import { THEME, themedSheet } from '../theme';

interface ShellProps {
  route: string;
  setRoute: (r: string) => void;
  user: { firstName: string; lastName: string; initials: string; plan: string } | null;
  children: React.ReactNode;
  unreadNotifications?: number;
}

const BOTTOM_NAV = [
  { id: 'overview',     label: 'Home',     icon: 'home'       },
  { id: 'transactions', label: 'Activity', icon: 'list'       },
  { id: 'transfer',     label: 'Send',     icon: 'send'       },
  { id: 'analytics',   label: 'Insights', icon: 'chart'      },
  { id: 'savings',      label: 'Goals',    icon: 'targetRing' },
];

export function Shell({ route, setRoute, user, children, unreadNotifications = 0 }: ShellProps) {
  return (
    <View style={styles.container}>
      {/* Top sticky bar */}
      <View style={styles.topBar}>
        <FVLogo size={26} />
        <View style={styles.topRight}>
          <TouchableOpacity
            style={styles.topBtn}
            onPress={() => setRoute('notifications')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Notifications"
            accessibilityRole="button"
          >
            <Icon name="bell" size={20} color={route === 'notifications' ? THEME.colors.accent : THEME.colors.text2} />
            {unreadNotifications > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadNotifications > 9 ? '9+' : unreadNotifications}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topBtn}
            onPress={() => setRoute('settings')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Open settings"
            accessibilityRole="button"
            accessibilityState={{ selected: route === 'settings' }}
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
          const active = route === nav.id || (nav.id === 'overview' && route.startsWith('account:'));

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
              accessibilityRole="tab"
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

const styles = themedSheet(() => StyleSheet.create({
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
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topBtn: {
    padding: 4,
    position: 'relative' as const,
  },
  badge: {
    position: 'absolute' as const,
    top: -2,
    right: -4,
    backgroundColor: '#fb7185',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: THEME.colors.bg,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
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
    gap: 4,
    minHeight: 44,
  },
  navIconWrap: {
    width: 48,
    height: 30,
    borderRadius: THEME.radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navIconWrapActive: {
    backgroundColor: THEME.colors.accentSoft,
  },
  navText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
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
}));
