import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, G, Rect } from 'react-native-svg';
import { THEME } from '../theme';

interface Props {
  size?: number;
  mono?: boolean;
}

export function FVLogo({ size = 28, mono = false }: Props) {
  const svgW = Math.round(size * 1.05);
  const svgH = Math.round(size * 0.93);
  const fontSize = Math.round(size * 0.66);
  const gap = Math.round(size * 0.34);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap }}>
      <Svg width={svgW} height={svgH} viewBox="0 0 72 64">
        {!mono && (
          <Defs>
            <LinearGradient id="fv-logo-grad" x1="0" y1="64" x2="72" y2="0" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#19f5c3" />
              <Stop offset="1" stopColor="#00bfa0" />
            </LinearGradient>
          </Defs>
        )}
        <G fill={mono ? THEME.colors.onAccent : 'url(#fv-logo-grad)'} transform="translate(8 0) skewX(-35)">
          <Rect x={26} y={10} width={38} height={14} rx={7} />
          <Rect x={26} y={32} width={26} height={14} rx={7} />
        </G>
      </Svg>
      <Text style={{ fontSize, fontWeight: '700', color: THEME.colors.text, letterSpacing: -0.5 }}>
        FinVault
      </Text>
    </View>
  );
}
