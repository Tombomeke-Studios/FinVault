import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AccessibilityInfo, Animated, Pressable, View, Text, Easing } from 'react-native';
import { THEME } from '../theme';

/**
 * Shared motion primitives — one source of truth for press feedback,
 * entrance animations and progress fills so every screen moves with
 * the same rhythm (spring physics, 150–300ms, reduced-motion aware).
 */

// ── Reduced motion ──────────────────────────────────────────────────
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (mounted) setReduced(v); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { mounted = false; sub.remove(); };
  }, []);
  return reduced;
}

// ── PressableScale — springy tap feedback ───────────────────────────
export function PressableScale({
  onPress,
  onLongPress,
  style,
  innerStyle,
  scaleTo = 0.95,
  disabled = false,
  children,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  hitSlop,
}: {
  onPress?: () => void;
  onLongPress?: () => void;
  style?: any;
  /** Style applied to the animated wrapper (the part that scales). */
  innerStyle?: any;
  scaleTo?: number;
  disabled?: boolean;
  children: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'tab' | 'link';
  accessibilityState?: object;
  hitSlop?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();

  const animate = (toValue: number, bounciness: number) => {
    if (reduced) { scale.setValue(1); return; }
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 50, bounciness }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => animate(scaleTo, 4)}
      onPressOut={() => animate(1, 6)}
      style={style}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled, ...accessibilityState }}
    >
      <Animated.View style={[innerStyle, { transform: [{ scale }] }, disabled && { opacity: 0.5 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// ── FadeSlideIn — staggered entrance ────────────────────────────────
export function FadeSlideIn({
  delay = 0,
  distance = 16,
  style,
  children,
}: {
  delay?: number;
  distance?: number;
  style?: any;
  children: React.ReactNode;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    const anim = Animated.spring(progress, {
      toValue: 1, tension: 60, friction: 11, delay, useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduced]);

  return (
    <Animated.View
      style={[style, {
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
}

// ── AnimatedProgressBar — fills to pct on mount/update ──────────────
export function AnimatedProgressBar({
  pct,
  color = THEME.colors.accent,
  height = 8,
  trackColor = THEME.colors.surfaceHi,
  style,
}: {
  pct: number;
  color?: string;
  height?: number;
  trackColor?: string;
  style?: any;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const fill = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  const [trackW, setTrackW] = useState(0);

  useEffect(() => {
    if (reduced) { fill.setValue(clamped); return; }
    Animated.spring(fill, { toValue: clamped, tension: 40, friction: 12, useNativeDriver: true }).start();
  }, [clamped, reduced]);

  return (
    <View
      style={[{ height, borderRadius: 99, backgroundColor: trackColor, overflow: 'hidden' }, style]}
      onLayout={e => setTrackW(e.nativeEvent.layout.width)}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
    >
      {trackW > 0 && (
        <Animated.View
          style={{
            height: '100%',
            width: trackW,
            borderRadius: 99,
            backgroundColor: color,
            transform: [{ translateX: fill.interpolate({ inputRange: [0, 100], outputRange: [-trackW, 0] }) }],
          }}
        />
      )}
    </View>
  );
}

// ── CountUp — animated number counter (Revolut-style) ──────────────
export function CountUp({
  value,
  duration = 800,
  formatter,
  style,
}: {
  value: number;
  duration?: number;
  formatter?: (v: number) => string;
  style?: any;
}) {
  const animVal = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(formatter ? formatter(0) : '0');
  const reduced = useReducedMotion();
  const prevValue = useRef(0);

  useEffect(() => {
    if (reduced) {
      setDisplay(formatter ? formatter(value) : String(value));
      prevValue.current = value;
      return;
    }
    animVal.setValue(0);
    const listener = animVal.addListener(({ value: v }) => {
      const current = prevValue.current + (value - prevValue.current) * v;
      setDisplay(formatter ? formatter(current) : Math.round(current).toString());
    });
    Animated.timing(animVal, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      prevValue.current = value;
    });
    return () => animVal.removeListener(listener);
  }, [value, reduced]);

  return <Text style={style}>{display}</Text>;
}

// ── Shimmer — loading skeleton placeholder ─────────────────────────
export function Shimmer({
  width,
  height = 16,
  borderRadius = 8,
  style,
}: {
  width: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduced]);

  return (
    <Animated.View
      style={[{
        width: width as any,
        height,
        borderRadius,
        backgroundColor: THEME.colors.surfaceHi,
        opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }),
      }, style]}
    />
  );
}

// ── ScaleIn — pop-in entrance (for icons, badges) ──────────────────
export function ScaleIn({
  delay = 0,
  style,
  children,
}: {
  delay?: number;
  style?: any;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) { scale.setValue(1); return; }
    const anim = Animated.spring(scale, {
      toValue: 1, tension: 100, friction: 8, delay, useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduced]);

  return (
    <Animated.View style={[style, { transform: [{ scale }], opacity: scale }]}>
      {children}
    </Animated.View>
  );
}

// ── SlideInFromRight — screen transition feel ──────────────────────
export function SlideInFromRight({
  delay = 0,
  style,
  children,
}: {
  delay?: number;
  style?: any;
  children: React.ReactNode;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    const anim = Animated.spring(progress, {
      toValue: 1, tension: 50, friction: 10, delay, useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduced]);

  return (
    <Animated.View
      style={[style, {
        opacity: progress,
        transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }],
      }]}
    >
      {children}
    </Animated.View>
  );
}
