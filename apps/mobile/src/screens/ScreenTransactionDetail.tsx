import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from '../components/Icon';
import { money, CategoryIcon, relTime } from '../components/UI';
import { FadeSlideIn, ScaleIn, CountUp } from '../components/Motion';
import { THEME, themedSheet } from '../theme';

interface Transaction {
  id: string;
  reference?: string;
  senderWalletId: string | null;
  receiverWalletId: string | null;
  amount: number;
  currency: string;
  status: string;
  type: string;
  description: string;
  createdAt: string;
}

interface Props {
  transaction: Transaction;
  isIncoming: boolean;
  onBack: () => void;
  onDispute: () => void;
}

export function ScreenTransactionDetail({ transaction: tx, isIncoming, onBack, onDispute }: Props) {
  const amt = isIncoming ? tx.amount : -tx.amount;
  const displayCat = tx.type === 'deposit' ? 'deposit' : 'transfer';
  const statusColor = tx.status === 'confirmed' ? THEME.colors.pos : tx.status === 'failed' ? '#fb7185' : THEME.colors.accent;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 88 }}>
      <FadeSlideIn delay={0}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="arrowLeft" size={22} color={THEME.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Transaction</Text>
          <View style={{ width: 22 }} />
        </View>
      </FadeSlideIn>

      <FadeSlideIn delay={40}>
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <CategoryIcon cat={displayCat} size={56} />
          </View>
          <CountUp
            value={Math.abs(amt)}
            duration={800}
            formatter={(v) => money(amt > 0 ? v : -v, tx.currency, { signed: true })}
            style={[styles.heroAmount, { color: amt > 0 ? THEME.colors.pos : THEME.colors.text }]}
          />
          <Text style={styles.heroDesc}>{tx.description}</Text>
          <ScaleIn delay={300}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '1A' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{tx.status.toUpperCase()}</Text>
            </View>
          </ScaleIn>
        </View>
      </FadeSlideIn>

      <FadeSlideIn delay={100}>
        <View style={styles.detailCard}>
          <DetailRow label="Type" value={tx.type.charAt(0).toUpperCase() + tx.type.slice(1)} />
          <DetailRow label="Reference" value={tx.reference || '—'} />
          <DetailRow label="Currency" value={tx.currency} />
          <DetailRow label="Date" value={new Date(tx.createdAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} />
          <DetailRow label="Time" value={new Date(tx.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} last />
        </View>
      </FadeSlideIn>

      <FadeSlideIn delay={160}>
        <TouchableOpacity style={styles.disputeBtn} onPress={onDispute}>
          <Icon name="alertTriangle" size={18} color="#fb7185" />
          <Text style={styles.disputeBtnText}>Report this transaction</Text>
        </TouchableOpacity>
      </FadeSlideIn>
    </ScrollView>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detailRow, !last && { borderBottomWidth: 1, borderBottomColor: THEME.colors.line }]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = themedSheet(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, marginBottom: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: THEME.colors.text, letterSpacing: -0.3 },
  heroCard: { backgroundColor: THEME.colors.glassBg, borderRadius: THEME.radius['2xl'], borderWidth: 1, borderColor: THEME.colors.line2, marginHorizontal: 16, padding: 32, alignItems: 'center', gap: 16, overflow: 'hidden', ...THEME.shadow.cardLg },
  heroIconWrap: { marginBottom: 8 },
  heroAmount: { fontSize: 44, fontWeight: '800', letterSpacing: -2, fontVariant: ['tabular-nums'] as any },
  heroDesc: { fontSize: 15, color: THEME.colors.text2, fontWeight: '600', textAlign: 'center', letterSpacing: -0.2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 16, borderRadius: THEME.radius.pill },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  detailCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.xl, borderWidth: 1, borderColor: THEME.colors.line, marginHorizontal: 16, marginTop: 20, ...THEME.shadow.card },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  detailLabel: { fontSize: 13, color: THEME.colors.text3, fontWeight: '500', letterSpacing: 0.2 },
  detailValue: { fontSize: 14, color: THEME.colors.text, fontWeight: '600', maxWidth: '60%' as any, textAlign: 'right', letterSpacing: -0.2 },
  disputeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 24, paddingVertical: 16, borderRadius: THEME.radius.xl, backgroundColor: 'rgba(251, 113, 133, 0.08)', borderWidth: 1, borderColor: 'rgba(251, 113, 133, 0.20)' },
  disputeBtnText: { color: '#fb7185', fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
}));
