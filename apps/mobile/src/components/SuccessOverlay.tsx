import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { CountUp, useReducedMotion } from './Motion';
import { money } from './UI';
import { THEME, themedSheet } from '../theme';

/**
 * Full-screen "it worked" moment after money moves (#125), the Revolut-style
 * payoff: a ring bursts outward, the check springs in, the amount counts up,
 * then the details fade up. Reduced motion shows the final state at once.
 * The success haptic comes from the toast the caller fires alongside.
 */
export function SuccessOverlay({ open, title, amount, currency = 'EUR', detail, onDone }: {
  open: boolean;
  title: string;
  amount: number;
  currency?: string;
  detail?: string;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const burst = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!open) return;
    if (reduced) { burst.setValue(1); check.setValue(1); text.setValue(1); return; }
    burst.setValue(0); check.setValue(0); text.setValue(0);
    Animated.parallel([
      Animated.timing(burst, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(check, { toValue: 1, tension: 140, friction: 6, useNativeDriver: true }),
      Animated.timing(text, { toValue: 1, duration: 360, delay: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [open, reduced]);

  const rise = { opacity: text, transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] };

  return (
    <Modal visible={open} animationType="fade" onRequestClose={onDone} statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
        <View style={styles.center} accessible accessibilityLiveRegion="polite"
          accessibilityLabel={`${title}. ${money(amount, currency)}${detail ? `, ${detail}` : ''}`}>
          <View style={styles.badgeArea}>
            <Animated.View
              style={[styles.burst, {
                opacity: burst.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.45, 0] }),
                transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.4] }) }],
              }]}
            />
            <Animated.View style={[styles.checkCircle, { transform: [{ scale: check }] }]}>
              <Icon name="check" size={44} color={THEME.colors.onAccent} />
            </Animated.View>
          </View>

          <Animated.Text style={[styles.title, rise]}>{title}</Animated.Text>
          <CountUp value={open ? amount : 0} duration={700} formatter={v => money(v, currency)} style={styles.amount} />
          {!!detail && <Animated.Text style={[styles.detail, rise]} numberOfLines={2}>{detail}</Animated.Text>}
        </View>

        <Animated.View style={rise}>
          <TouchableOpacity style={styles.doneBtn} onPress={onDone} accessibilityRole="button" activeOpacity={0.85}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = themedSheet(() => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  badgeArea: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  burst: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: THEME.colors.accent,
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: THEME.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '600', color: THEME.colors.text2 },
  amount: { fontSize: 40, fontWeight: '800', color: THEME.colors.text, letterSpacing: -1 },
  detail: { fontSize: 15, color: THEME.colors.text2, textAlign: 'center', maxWidth: 300 },
  doneBtn: {
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.radius.regular,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: { fontSize: 16, fontWeight: '700', color: THEME.colors.onAccent },
}));
