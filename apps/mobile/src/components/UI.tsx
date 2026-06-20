import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Icon } from './Icon';
import { THEME, themedSheet } from '../theme';

// ---- Formatters ----
// `whole` drops cents via Intl options — never strip ".00" from the formatted
// string: nl-NL uses "." as the thousands separator, so "€ 4.000,00" would
// get mangled into "€ 40,00".
export function money(val: number, currency = 'EUR', opts?: { signed?: boolean; whole?: boolean }) {
  const formatted = val.toLocaleString('nl-NL', {
    style: 'currency',
    currency,
    ...(opts?.whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
  });
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
  const [width, setWidth] = React.useState(0);
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const dx = width > 0 ? width / (data.length - 1) : 0;

  const points = data.map((val, idx) => {
    const x = idx * dx;
    const y = h - ((val - min) / range) * (h - 8) - 4;
    return `${x},${y}`;
  });

  const path = `M ${points.map(p => p.replace(',', ' ')).join(' L ')}`;

  return (
    <View
      style={{ height: h, width: '100%', overflow: 'hidden' }}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Svg height={h} width={width}>
          <Path d={path} fill="none" stroke={THEME.colors.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
    </View>
  );
}

// ---- Cash Flow Bar Chart ----
export function Bars({ data, h = 140 }: { data: { m: string; in: number; out: number }[]; h?: number }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.flatMap(d => [d.in, d.out]), 1);
  const barW = 10;
  const gap = 4;
  const groupW = barW * 2 + gap + 14;
  return (
    <View style={{ height: h + 20, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: h }}>
            <View style={{ width: barW, height: Math.max(4, (d.in / maxVal) * h), backgroundColor: THEME.colors.accent, borderRadius: 3 }} />
            <View style={{ width: barW, height: Math.max(4, (d.out / maxVal) * h), backgroundColor: 'rgba(248, 113, 113, 0.55)', borderRadius: 3 }} />
          </View>
          <Text style={{ fontSize: 9, color: THEME.colors.text3, fontWeight: 'bold' }}>{d.m}</Text>
        </View>
      ))}
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
const styles = themedSheet(() => StyleSheet.create({
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
    borderRadius: THEME.radius.pill,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  avatar: {
    backgroundColor: 'rgba(139, 92, 246, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
  },
}));
