import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from './Icon';
import { THEME } from '../theme';
import { useReducedMotion } from './Motion';

/**
 * Non-blocking toast notifications. Replaces Alert.alert for success/info
 * feedback so the user is never interrupted mid-flow. Destructive
 * confirmations should still use Alert (they need an explicit decision).
 */

export type ToastType = 'success' | 'info' | 'warn' | 'error';

export interface ToastData {
  id: number;
  title: string;
  body?: string;
  type: ToastType;
}

const TYPE_META: Record<ToastType, { icon: string; color: string }> = {
  success: { icon: 'check',         color: THEME.colors.pos },
  info:    { icon: 'info',          color: '#60a5fa' },
  warn:    { icon: 'alertTriangle', color: THEME.colors.warn },
  error:   { icon: 'x',             color: THEME.colors.neg },
};

const AUTO_DISMISS_MS = 3500;

function ToastCard({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: number) => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  const meta = TYPE_META[toast.type] || TYPE_META.info;

  const dismiss = useCallback(() => {
    if (reduced) { onDismiss(toast.id); return; }
    // Exit faster than enter (~60% duration), ease-in feel.
    Animated.timing(progress, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => onDismiss(toast.id));
  }, [onDismiss, reduced, toast.id]);

  useEffect(() => {
    if (reduced) progress.setValue(1);
    else Animated.spring(progress, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }).start();
    const t = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View
      style={[styles.toast, {
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
      }]}
      accessibilityLiveRegion="polite"
    >
      <View style={[styles.iconWrap, { backgroundColor: `${meta.color}26` }]}>
        <Icon name={meta.icon} size={15} color={meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{toast.title}</Text>
        {!!toast.body && <Text style={styles.body} numberOfLines={2}>{toast.body}</Text>}
      </View>
      <TouchableOpacity
        onPress={dismiss}
        style={styles.closeBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Dismiss notification"
        accessibilityRole="button"
      >
        <Icon name="x" size={14} color={THEME.colors.text3} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ToastHost({ toasts, onDismiss }: { toasts: ToastData[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <View style={styles.host} pointerEvents="box-none">
      {toasts.map(t => <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />)}
    </View>
  );
}

let toastSeq = 0;

/** State + helpers for the toast stack. Use `fire(title, body, type)` anywhere. */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const fire = useCallback((title: string, body?: string, type: string = 'info') => {
    const safeType: ToastType = (['success', 'info', 'warn', 'error'].includes(type) ? type : 'info') as ToastType;
    setToasts(prev => [...prev.slice(-2), { id: ++toastSeq, title, body, type: safeType }]);
  }, []);

  return { toasts, fire, dismiss };
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 64,
    left: 16,
    right: 16,
    gap: 8,
    zIndex: 1000,
    elevation: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.surfaceHi,
    borderWidth: 1,
    borderColor: THEME.colors.line2,
    borderRadius: THEME.radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 13.5,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  body: {
    fontSize: 12,
    color: THEME.colors.text2,
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
});
