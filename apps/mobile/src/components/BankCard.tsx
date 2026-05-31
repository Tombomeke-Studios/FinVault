import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { THEME } from '../theme';

interface CardProps {
  card: {
    id: string;
    name: string;
    kind: 'physical' | 'virtual';
    network: string;
    last4: string;
    number: string;
    cvv: string;
    holder: string;
    exp: string;
    frozen: boolean;
    scheme: string;
    walletId: string;
  };
  revealed?: boolean;
}

export function BankCard({ card, revealed = false }: CardProps) {
  const isPhysical = card.kind === 'physical';

  // Different color schemes for physical vs virtual cards
  const bg = isPhysical ? '#1e1b4b' : '#0369a1';
  const schemeColor = card.scheme === 'metal' ? '#10b981' : '#06b6d4';

  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: schemeColor }]}>
      {/* Background radial-like gradient visual using absolute positioning circles */}
      <View style={[styles.glowRing, { borderColor: schemeColor }]} />

      {/* Card header */}
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardName}>{card.name}</Text>
          <Text style={styles.cardKind}>{card.kind.toUpperCase()}</Text>
        </View>
        <Text style={styles.network}>{card.network}</Text>
      </View>

      {/* Chip simulator */}
      <View style={styles.chip} />

      {/* Card number */}
      <View style={styles.numberRow}>
        <Text style={styles.cardNumber}>
          {revealed ? card.number : `••••  ••••  ••••  ${card.last4}`}
        </Text>
      </View>

      {/* Footer details */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.label}>HOLDER</Text>
          <Text style={styles.holder}>{card.holder}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.label}>EXPIRY</Text>
          <Text style={styles.expiry}>{card.exp}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: 1.58, // Standard credit card aspect ratio
    borderRadius: THEME.radius.lg,
    padding: 20,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1.5,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  glowRing: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 20,
    opacity: 0.15,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  cardKind: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  network: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    fontStyle: 'italic',
  },
  chip: {
    width: 32,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#fbbf24',
    opacity: 0.8,
    marginVertical: 10,
  },
  numberRow: {
    marginVertical: 4,
  },
  cardNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  label: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 4,
  },
  holder: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  expiry: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
