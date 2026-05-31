import React from 'react';
import { Feather } from '@expo/vector-icons';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
  stroke?: number;
}

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
  shield: 'shield',
  sparkle: 'star',
  x: 'x',
  check: 'check',
  arrowDownLeft: 'arrow-down-left',
  arrowUpRight: 'arrow-up-right',
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
  repeat: 'repeat',
  heart: 'heart',
  cart: 'shopping-cart',
  coffee: 'coffee',
  bag: 'shopping-bag',
};

export function Icon({ name, size = 20, color = '#f7f7f9', style }: IconProps) {
  const iconName = MAPPING[name] || 'help-circle';
  return <Feather name={iconName} size={size} color={color} style={style} />;
}
