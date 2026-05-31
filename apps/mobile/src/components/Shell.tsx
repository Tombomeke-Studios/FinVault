import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
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
  { id: 'transfer',     label: 'Money',    icon: 'send'       },
  { id: 'cards',        label: 'Cards',    icon: 'card'       },
  { id: 'savings',      label: 'Goals',    icon: 'targetRing' },
];

export function Shell({ route, setRoute, user, children }: ShellProps) {
  return (
    <View style={styles.container}>
      {/* Top sticky bar */}
      <View style={styles.topBar}>
        <Text style={styles.logoText}>FinVault</Text>
        <View style={styles.topRight}>
          <TouchableOpacity style={styles.topBtn} onPress={() => setRoute('settings')}>
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
                activeOpacity={0.9}
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
            >
              <Icon
                name={nav.icon}
                size={22}
                color={active ? THEME.colors.accent : THEME.colors.text3}
              />
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
  logoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: -0.4,
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
    paddingVertical: 8,
    flex: 1,
  },
  navText: {
    fontSize: 9.5,
    fontWeight: 'bold',
    marginTop: 4,
  },
  floatingBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: THEME.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: THEME.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 6,
    transform: [{ translateY: -12 }],
  },
});
