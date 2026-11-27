import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from './Icon';
import { Avatar } from './UI';
import { FVLogo } from './FVLogo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../haptics';
import { RouteTransition, useReducedMotion } from './Motion';
import { TAB_ORDER, routeDirection, tabOf } from '../lib/routes';
import { THEME, themedSheet } from '../theme';

interface ShellProps {
  route: string;
  setRoute: (r: string) => void;
  user: { firstName: string; lastName: string; initials: string; plan: string } | null;
  children: React.ReactNode;
  unreadNotifications?: number;
}

const NAV_HEIGHT = 64;

const BOTTOM_NAV = [
  { id: 'overview',     label: 'Home',     icon: 'home'       },
  { id: 'transactions', label: 'Activity', icon: 'list'       },
  { id: 'transfer',     label: 'Send',     icon: 'send'       },
  { id: 'analytics',   label: 'Insights', icon: 'chart'      },
  { id: 'savings',      label: 'Goals',    icon: 'targetRing' },
];

// Tab icon that springs up when its tab becomes active (#125).
function TabIcon({ name, active, color, size = 21 }: { name: string; active: boolean; color: string; size?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const was = useRef(active);
  useEffect(() => {
    if (active && !was.current && !reduced) {
      scale.setValue(0.78);
      Animated.spring(scale, { toValue: 1, tension: 240, friction: 7, useNativeDriver: true }).start();
    }
    was.current = active;
  }, [active]);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Icon name={name} size={size} color={color} />
    </Animated.View>
  );
}

const PILL_W = 48;

export function Shell({ route, setRoute, user, children, unreadNotifications = 0 }: ShellProps) {
  // Android draws edge-to-edge: without the bottom inset the tabs sit under the
  // system navigation bar (gesture pill or 3-button bar).
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  // Screens slide in from the side you are heading to (#125).
  const prevRoute = useRef(route);
  const direction = useMemo(() => routeDirection(prevRoute.current, route), [route]);
  useEffect(() => { prevRoute.current = route; }, [route]);

  // One highlight pill that glides between tabs instead of jumping.
  const [barW, setBarW] = useState(0);
  const [pillTop, setPillTop] = useState(8);
  const tab = tabOf(route);
  const tabIdx = tab ? TAB_ORDER.indexOf(tab as any) : -1;
  const pillX = useRef(new Animated.Value(0)).current;
  const pillOpacity = useRef(new Animated.Value(tabIdx >= 0 ? 1 : 0)).current;
  const placed = useRef(false);
  useEffect(() => {
    if (!barW) return;
    const itemW = barW / TAB_ORDER.length;
    if (tabIdx >= 0) {
      const x = tabIdx * itemW + (itemW - PILL_W) / 2;
      if (!placed.current || reduced) { pillX.setValue(x); placed.current = true; }
      else Animated.spring(pillX, { toValue: x, tension: 170, friction: 20, useNativeDriver: true }).start();
    }
    Animated.timing(pillOpacity, { toValue: tabIdx >= 0 ? 1 : 0, duration: 150, useNativeDriver: true }).start();
  }, [tabIdx, barW]);

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
        <RouteTransition routeKey={route} direction={direction}>
          {children}
        </RouteTransition>
      </View>

      {/* Bottom sticky navigation row */}
      <View
        style={[styles.navBar, { paddingBottom: insets.bottom, height: NAV_HEIGHT + insets.bottom }]}
        accessibilityRole="tablist"
        onLayout={e => setBarW(e.nativeEvent.layout.width)}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.pill, { top: pillTop, opacity: pillOpacity, transform: [{ translateX: pillX }] }]}
        />
        {BOTTOM_NAV.map((nav, i) => {
          const active = route === nav.id || (nav.id === 'overview' && route.startsWith('account:'));

          if (nav.id === 'transfer') {
            return (
              <TouchableOpacity
                key={nav.id}
                onPress={() => { if (!active) haptic.select(); setRoute(nav.id); }}
                style={styles.navItem}
                activeOpacity={0.85}
                accessibilityLabel="Send money"
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <View style={styles.sendBtn}>
                  <TabIcon name="send" size={20} active={active} color={THEME.colors.onAccent} />
                </View>
                <Text style={[styles.navText, { color: active ? THEME.colors.accent : THEME.colors.text2 }]}>{nav.label}</Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={nav.id}
              onPress={() => { if (!active) haptic.select(); setRoute(nav.id); }}
              style={styles.navItem}
              activeOpacity={0.7}
              accessibilityLabel={nav.label}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <View style={styles.navIconWrap} onLayout={i === 0 ? e => setPillTop(e.nativeEvent.layout.y) : undefined}>
                <TabIcon name={nav.icon} active={active} color={active ? THEME.colors.accent : THEME.colors.text2} />
              </View>
              <Text style={[styles.navText, { color: active ? THEME.colors.accent : THEME.colors.text2 }]}>
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
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'stretch',
    borderTopWidth: 1,
    borderTopColor: THEME.colors.line,
    backgroundColor: THEME.colors.surface,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    flex: 1,
    gap: 4,
    minHeight: 48,
  },
  navIconWrap: {
    width: 48,
    height: 30,
    borderRadius: THEME.radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pill: {
    position: 'absolute',
    left: 0,
    width: PILL_W,
    height: 30,
    borderRadius: THEME.radius.xl,
    backgroundColor: THEME.colors.accentSoft,
  },
  navText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  // Send stays the visual primary action, but inside the bar (no overlap
  // with the content above) and with a label like the other tabs.
  sendBtn: {
    width: 48,
    height: 30,
    borderRadius: THEME.radius.xl,
    backgroundColor: THEME.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
