import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Pressable, View, Text, Easing, StyleSheet, type ViewStyle, type TextStyle, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { THEME } from '../theme';
import { haptic } from '../haptics';
import { Icon } from './Icon';
import { odometerCells } from '../lib/odometer';

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
  haptics = true,
}: {
  /** Light tick on touch-down (#125); off for surfaces that tick themselves. */
  haptics?: boolean;
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
      onPressIn={() => { if (haptics && !disabled) haptic.tap(); animate(scaleTo, 4); }}
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

// ── AnimatedCard — glass surface + entrance + press feedback ────────
export function AnimatedCard({
  children,
  delay = 0,
  glass = false,
  onPress,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  glass?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const cardStyle = useMemo<ViewStyle>(() => ({
    backgroundColor: glass ? THEME.colors.glassBg : THEME.colors.surface,
    borderRadius: glass ? (THEME.radius as any)['2xl'] ?? 28 : THEME.radius.xl,
    borderWidth: 1,
    borderColor: glass ? THEME.colors.line2 : THEME.colors.line,
    padding: THEME.spacing.gap,
    overflow: 'hidden' as const,
    ...THEME.shadow[glass ? 'cardLg' : 'card'],
    ...style,
  }), [glass, style]);

  const content = (
    <FadeSlideIn delay={delay}>
      <View style={cardStyle}>{children}</View>
    </FadeSlideIn>
  );

  if (!onPress) return content;

  return (
    <FadeSlideIn delay={delay}>
      <PressableScale onPress={onPress} scaleTo={0.97}>
        <View style={cardStyle}>{children}</View>
      </PressableScale>
    </FadeSlideIn>
  );
}

// ── BalanceDisplay — consistent money typography ────────────────────
export function BalanceDisplay({
  value,
  formatter,
  size = 40,
  color,
  style,
}: {
  value: number;
  formatter: (v: number) => string;
  size?: number;
  color?: string;
  style?: TextStyle;
}) {
  const textStyle = useMemo<TextStyle>(() => ({
    fontSize: size,
    fontWeight: '800',
    letterSpacing: size > 30 ? -1.5 : -0.8,
    color: color ?? THEME.colors.text,
    fontVariant: ['tabular-nums'],
    ...style,
  }), [size, color, style]);

  return <RollingNumber value={value} formatter={formatter} style={textStyle} />;
}

// ── RollingNumber — odometer digits (#127) ──────────────────────────
// Each digit is a 0–9 column that springs to its value, right to left with a
// small stagger, like a mechanical counter. Separators and the currency sign
// stay still (lib/odometer.ts). Screen readers get the plain text once.
function DigitColumn({ digit, lineHeight, delay, textStyle }: { digit: number; lineHeight: number; delay: number; textStyle: TextStyle }) {
  const y = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    const to = -digit * lineHeight;
    if (reduced) { y.setValue(to); return; }
    Animated.spring(y, { toValue: to, tension: 90, friction: 14, delay, useNativeDriver: true }).start();
  }, [digit, lineHeight, reduced]);
  return (
    <View style={{ height: lineHeight, overflow: 'hidden' }}>
      {/* Sizes the column to the digit's width; the rolling strip sits on top. */}
      <Text style={[textStyle, { lineHeight, opacity: 0 }]}>{digit}</Text>
      <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: [{ translateY: y }] }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <Text key={n} style={[textStyle, { lineHeight, textAlign: 'center' }]}>{n}</Text>
        ))}
      </Animated.View>
    </View>
  );
}

export function RollingNumber({ value, formatter, style }: { value: number; formatter: (v: number) => string; style: TextStyle }) {
  const text = formatter(value);
  const cells = odometerCells(text);
  const lineHeight = Math.round(((style.fontSize as number) || 16) * 1.2);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }} accessible accessibilityRole="text" accessibilityLabel={text}>
      {cells.map((c, i) => c.digit === null
        ? <Text key={c.key} style={[style, { lineHeight }]} importantForAccessibility="no">{c.char}</Text>
        : <DigitColumn key={c.key} digit={c.digit} lineHeight={lineHeight} delay={(cells.length - 1 - i) * 28} textStyle={style} />)}
    </View>
  );
}

// ── useParallax — scroll-driven parallax for hero cards ────────────
export function useParallax(factor = 0.4) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  const onScroll = useMemo(() =>
    Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      { useNativeDriver: true }
    ),
    []
  );

  const heroStyle = useMemo(() => {
    if (reduced) return {};
    return {
      transform: [{
        translateY: scrollY.interpolate({
          inputRange: [-100, 0, 200],
          outputRange: [100 * factor, 0, -200 * factor],
          extrapolate: 'clamp',
        }),
      }, {
        scale: scrollY.interpolate({
          inputRange: [-200, 0],
          outputRange: [1.1, 1],
          extrapolate: 'clamp',
        }),
      }],
    };
  }, [reduced, factor]);

  return { onScroll, heroStyle, scrollY };
}

// ── RouteTransition — screen changes glide in (#125) ────────────────
// Keyed on the route: the new screen fades in while sliding 28px from the
// side it comes from (`direction`, see lib/routes.ts). useLayoutEffect resets
// the value before the first paint, so the new screen never flashes at rest.
export function RouteTransition({ routeKey, direction, children }: {
  routeKey: string;
  direction: 1 | -1 | 0;
  children: React.ReactNode;
}) {
  const progress = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const first = useRef(true);
  const dir = useRef(direction);
  dir.current = direction;

  React.useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduced || direction === 0) { progress.setValue(1); return; }
    progress.setValue(0);
    Animated.spring(progress, { toValue: 1, tension: 120, friction: 18, useNativeDriver: true }).start();
  }, [routeKey]);

  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
        transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [28 * (dir.current || 1), 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

// ── SwipeRow — swipe a list row left to reveal actions (#127) ───────
// Built on PanResponder (no gesture library needed). Only a clearly
// horizontal drag is claimed, so vertical list scrolling keeps working.
// `open`/`onOpenChange` are controlled by the list so one row is open at a
// time. Screen readers get the same actions through accessibilityActions.
export interface SwipeAction { key: string; label: string; icon: string; color: string; onPress: () => void }

export function SwipeRow({ actions, open, onOpenChange, children, style }: {
  actions: SwipeAction[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  style?: any;
}) {
  const ACTION_W = 76;
  const width = actions.length * ACTION_W;
  const tx = useRef(new Animated.Value(0)).current;
  const base = useRef(0);
  const armed = useRef(false);
  const reduced = useReducedMotion();
  const openRef = useRef(open);
  openRef.current = open;

  const settle = useCallback((toOpen: boolean) => {
    const to = toOpen ? -width : 0;
    base.current = to;
    if (reduced) tx.setValue(to);
    else Animated.spring(tx, { toValue: to, tension: 140, friction: 18, useNativeDriver: true }).start();
  }, [width, reduced]);

  useEffect(() => { settle(open); }, [open, settle]);

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { armed.current = openRef.current; },
    onPanResponderMove: (_, g) => {
      let x = base.current + g.dx;
      if (x > 0) x = x * 0.25;                          // rubber band past closed
      if (x < -width) x = -width + (x + width) * 0.25;  // and past fully open
      tx.setValue(x);
      const past = x < -width / 2;
      if (past !== armed.current) { armed.current = past; haptic.select(); }
    },
    onPanResponderRelease: (_, g) => {
      const x = base.current + g.dx;
      const shouldOpen = g.vx < -0.4 || (g.vx <= 0.4 && x < -width / 2);
      settle(shouldOpen);
      if (shouldOpen !== openRef.current) onOpenChange(shouldOpen);
    },
    onPanResponderTerminate: () => settle(openRef.current),
  }), [width, settle, onOpenChange]);

  return (
    <View
      style={[{ position: 'relative' }, style]}
      accessibilityActions={actions.map(a => ({ name: a.key, label: a.label }))}
      onAccessibilityAction={e => actions.find(a => a.key === e.nativeEvent.actionName)?.onPress()}
    >
      <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', justifyContent: 'flex-end', borderRadius: THEME.radius.regular, overflow: 'hidden' }]}>
        {actions.map(a => (
          <Pressable
            key={a.key}
            onPress={() => { onOpenChange(false); a.onPress(); }}
            style={{ width: ACTION_W, backgroundColor: a.color, alignItems: 'center', justifyContent: 'center', gap: 4 }}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
          >
            <Icon name={a.icon} size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
      <Animated.View style={{ transform: [{ translateX: tx }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}
