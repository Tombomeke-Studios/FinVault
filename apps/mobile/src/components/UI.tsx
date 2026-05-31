import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Icon } from './Icon';
import { THEME } from '../theme';

// ---- Formatters ----
export function money(val: number, currency = 'EUR', opts?: { signed?: boolean }) {
  const formatted = val.toLocaleString('nl-NL', { style: 'currency', currency });
  if (opts?.signed && val > 0) return '+' + formatted;
  return formatted;
}

export function relTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function catColor(hue: number) {
  return `hsl(${hue}, 70%, 65%)`;
}

// ---- CategoryIcon ----
export function CategoryIcon({ cat, size = 36 }: { cat: string; size?: number }) {
  const cats: Record<string, { bg: string; color: string; icon: string }> = {
    deposit:   { bg: 'rgba(52, 211, 153, 0.16)', color: THEME.colors.pos, icon: 'arrowDownLeft' },
    transfer:  { bg: 'rgba(168, 85, 247, 0.16)', color: '#c084fc', icon: 'send' },
    groceries: { bg: 'rgba(34, 197, 94, 0.16)', color: '#4ade80', icon: 'cart' },
    dining:    { bg: 'rgba(249, 115, 22, 0.16)', color: '#fdba74', icon: 'coffee' },
    transport: { bg: 'rgba(59, 130, 246, 0.16)', color: '#60a5fa', icon: 'car' },
    shopping:  { bg: 'rgba(236, 72, 153, 0.16)', color: '#f472b6', icon: 'bag' },
    bills:     { bg: 'rgba(14, 165, 233, 0.16)', color: '#38bdf8', icon: 'bolt' },
    subs:      { bg: 'rgba(219, 39, 119, 0.16)', color: '#f472b6', icon: 'repeat' },
    health:    { bg: 'rgba(239, 68, 68, 0.16)', color: '#f87171', icon: 'heart' },
    travel:    { bg: 'rgba(6, 182, 212, 0.16)', color: '#22d3ee', icon: 'plane' },
  };

  const m = cats[cat] || cats.transfer;

  return (
    <View style={[styles.catCircle, { width: size, height: size, borderRadius: size / 2, backgroundColor: m.bg }]}>
      <Icon name={m.icon} size={size * 0.5} color={m.color} />
    </View>
  );
}

// ---- Delta ----
export function Delta({ value }: { value: number }) {
  const isPos = value >= 0;
  return (
    <View style={[styles.delta, { backgroundColor: isPos ? 'rgba(52, 211, 153, 0.13)' : 'rgba(248, 113, 113, 0.13)' }]}>
      <Icon name={isPos ? 'arrowUpRight' : 'arrowDownLeft'} size={12} color={isPos ? THEME.colors.pos : THEME.colors.neg} />
      <Text style={[styles.deltaText, { color: isPos ? THEME.colors.pos : THEME.colors.neg }]}>
        {Math.abs(value).toFixed(1)}%
      </Text>
    </View>
  );
}

// ---- Progress Ring ----
export function Ring({ pct, size = 52, thickness = 6, color = THEME.colors.accent, children }: {
  pct: number;
  size?: number;
  thickness?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const strokeDashoffset = circ - (Math.min(100, Math.max(0, pct)) / 100) * circ;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={THEME.colors.line} strokeWidth={thickness} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={thickness}
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

// ---- Donut Chart ----
export function Donut({ size = 100, thickness = 14, segments, children }: {
  size?: number;
  thickness?: number;
  segments: Array<{ value: number; color: string }>;
  children?: React.ReactNode;
}) {
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  let accumulatedPercent = 0;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={THEME.colors.line} strokeWidth={thickness} fill="none" />
        {segments.map((seg, i) => {
          const valPct = total > 0 ? (seg.value / total) * 100 : 0;
          const strokeDashoffset = circ - (valPct / 100) * circ;
          const rotation = (accumulatedPercent / 100) * 360 - 90;
          accumulatedPercent += valPct;

          return (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${circ} ${circ}`}
              strokeDashoffset={strokeDashoffset}
              fill="none"
              transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
            />
          );
        })}
      </Svg>
      <View style={{ alignItems: 'center' }}>
        {children}
      </View>
    </View>
  );
}

// ---- Sparkline Trend Chart ----
export function Sparkline({ data, h = 60 }: { data: number[]; h?: number }) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const width = 360; // Approximate phone card width
  const dx = width / (data.length - 1);

  const points = data.map((val, idx) => {
    const x = idx * dx;
    const y = h - ((val - min) / range) * (h - 8) - 4;
    return `${x},${y}`;
  });

  const path = `M ${points.map(p => p.replace(',', ' ')).join(' L ')}`;

  return (
    <View style={{ height: h, width: '100%', overflow: 'hidden' }}>
      <Svg height={h} width="100%">
        <Path d={path} fill="none" stroke={THEME.colors.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

// ---- Avatar ----
export function Avatar({ initials, size = 38 }: { initials: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{initials}</Text>
    </View>
  );
}

// ---- Styles ----
const styles = StyleSheet.create({
  catCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  delta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: THEME.radius.xs,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  avatar: {
    backgroundColor: '#8b5cf6', // Indigo background for users
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: THEME.colors.line2,
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
