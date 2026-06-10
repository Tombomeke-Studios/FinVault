import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { THEME } from '../theme';

interface CardProps {
  card: {
    id: string; name: string; kind: 'physical' | 'virtual'; network: string;
    last4: string; number: string; cvv: string; holder: string; exp: string;
    frozen: boolean; scheme: string; walletId: string;
  };
  revealed?: boolean;
}

const SCHEMES: Record<string, { bg: string; accent: string; glow: string }> = {
  metal:  { bg: '#1a1040', accent: '#a78bfa', glow: 'rgba(167,139,250,0.35)' },
  cyan:   { bg: '#0c3650', accent: '#34d399', glow: 'rgba(52,211,153,0.35)' },
  violet: { bg: '#2d1b69', accent: '#c084fc', glow: 'rgba(192,132,252,0.35)' },
  gold:   { bg: '#3a2a08', accent: '#fbbf24', glow: 'rgba(251,191,36,0.35)' },
  accent: { bg: '#0b3328', accent: '#34d399', glow: 'rgba(52,211,153,0.35)' },
};

export const CARD_SCHEMES = SCHEMES;

export function BankCard({ card, revealed = false }: CardProps) {
  const sc = SCHEMES[card.scheme] || SCHEMES.metal;

  return (
    <View style={[styles.card, { backgroundColor: sc.bg, shadowColor: sc.glow }]}>
      {/* Decorative circle top-right */}
      <View style={[styles.circleTop, { borderColor: `${sc.accent}30` }]} />
      {/* Sheen overlay */}
      <View style={styles.sheen} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.issuerLabel}>FinVault</Text>
          <Text style={styles.cardName}>{card.name}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {card.frozen && (
            <View style={styles.frozenBadge}>
              <Text style={styles.frozenText}>FROZEN</Text>
            </View>
          )}
          <Text style={[styles.network, { color: sc.accent }]}>{card.network}</Text>
        </View>
      </View>

      {/* Chip */}
      <View style={styles.chipOuter}>
        <View style={styles.chipInner} />
      </View>

      {/* Card number */}
      <Text style={styles.cardNumber}>
        {revealed ? card.number : `•••• •••• •••• ${card.last4}`}
      </Text>

      {/* Footer */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.fieldLabel}>CARD HOLDER</Text>
          <Text style={styles.fieldValue}>{card.holder}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.fieldLabel}>EXPIRES</Text>
          <Text style={styles.fieldValue}>{card.exp}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: 1.586,
    borderRadius: 20,
    padding: 22,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 16,
  },
  circleTop: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sheen: {
    position: 'absolute',
    top: -30,
    left: -20,
    right: '30%',
    height: 120,
    backgroundColor: 'rgba(255,255,255,0.06)',
    transform: [{ rotate: '-20deg' }],
    borderRadius: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  issuerLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  cardName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  network: {
    fontSize: 16,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -0.5,
  },
  frozenBadge: {
    backgroundColor: 'rgba(248,113,113,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.4)',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  frozenText: {
    color: '#fca5a5',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  chipOuter: {
    width: 38,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  chipInner: {
    width: 24,
    height: 18,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.25)',
    backgroundColor: 'rgba(254,243,199,0.6)',
  },
  cardNumber: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 3,
    fontVariant: ['tabular-nums'],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  fieldValue: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
