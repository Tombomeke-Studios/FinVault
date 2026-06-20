import React from 'react';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
  stroke?: number;
}

// Icons Feather doesn't ship — rendered via MaterialCommunityIcons instead.
const MCI_MAPPING: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  flame: 'fire',
  faceId: 'face-recognition',
};

const MAPPING: Record<string, keyof typeof Feather.glyphMap> = {
  home: 'home',
  list: 'list',
  send: 'send',
  card: 'credit-card',
  chart: 'bar-chart-2',
  targetRing: 'target',
  settings: 'settings',
  bell: 'bell',
  search: 'search',
  plus: 'plus',
  qr: 'aperture',
  bolt: 'zap',
  snow: 'wind',
  shield: 'shield',
  sparkle: 'star',
  x: 'x',
  check: 'check',
  arrowDownLeft: 'arrow-down-left',
  arrowUpRight: 'arrow-up-right',
  arrowLeft: 'arrow-left',
  arrowRight: 'arrow-right',
  chevRight: 'chevron-right',
  eye: 'eye',
  eyeOff: 'eye-off',
  download: 'download',
  laptop: 'monitor',
  plane: 'navigation',
  car: 'truck',
  lock: 'lock',
  copy: 'copy',
  logout: 'log-out',
  edit: 'edit-2',
  trash: 'trash-2',
  repeat: 'repeat',
  heart: 'heart',
  cart: 'shopping-cart',
  coffee: 'coffee',
  bag: 'shopping-bag',
  trend: 'trending-up',
  target: 'crosshair',
  clock: 'clock',
  gift: 'gift',
  globe: 'globe',
  user: 'user',
  fingerprint: 'key',
  alertTriangle: 'alert-triangle',
  info: 'info',
  calendar: 'calendar',
  file: 'file-text',
  inbox: 'inbox',
  percent: 'percent',
  moon: 'moon',
  smartphone: 'smartphone',
};

export function Icon({ name, size = 20, color = '#f7f7f9', style }: IconProps) {
  const mci = MCI_MAPPING[name];
  if (mci) return <MaterialCommunityIcons name={mci} size={size} color={color} style={style} />;
  const iconName = MAPPING[name] || 'help-circle';
  return <Feather name={iconName} size={size} color={color} style={style} />;
}
