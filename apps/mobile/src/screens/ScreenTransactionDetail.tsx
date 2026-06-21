import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from '../components/Icon';
import { money, CategoryIcon, relTime } from '../components/UI';
import { FadeSlideIn } from '../components/Motion';
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
          <Text style={[styles.heroAmount, { color: amt > 0 ? THEME.colors.pos : THEME.colors.text }]}>
            {money(amt, tx.currency, { signed: true })}
          </Text>
          <Text style={styles.heroDesc}>{tx.description}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '1A' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{tx.status.toUpperCase()}</Text>
          </View>
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
  heroCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.xl, borderWidth: 1, borderColor: THEME.colors.line, marginHorizontal: 16, padding: 28, alignItems: 'center', gap: 12, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 8 },
  heroIconWrap: { marginBottom: 4 },
  heroAmount: { fontSize: 36, fontWeight: '800', letterSpacing: -1.5 },
  heroDesc: { fontSize: 15, color: THEME.colors.text2, fontWeight: '600', textAlign: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 14, borderRadius: THEME.radius.pill },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  detailCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.line, marginHorizontal: 16, marginTop: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18 },
  detailLabel: { fontSize: 13, color: THEME.colors.text3, fontWeight: '600' },
  detailValue: { fontSize: 14, color: THEME.colors.text, fontWeight: '600', maxWidth: '60%' as any, textAlign: 'right' },
  disputeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 20, paddingVertical: 14, borderRadius: THEME.radius.regular, borderWidth: 1, borderColor: '#fb718533' },
  disputeBtnText: { color: '#fb7185', fontSize: 14, fontWeight: '600' },
}));
