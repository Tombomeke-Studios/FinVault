import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Icon } from '../components/Icon';
import { money } from '../components/UI';
import { MobileSheet } from '../components/MobileExtras';
import { FadeSlideIn } from '../components/Motion';
import { THEME, themedSheet } from '../theme';

interface Dispute {
  id: string;
  transactionId: string;
  reason: string;
  status: string;
  resolution?: string | null;
  createdAt: string;
}

interface Transaction {
  id: string;
  reference?: string;
  amount: number;
  description: string;
  createdAt: string;
}

interface Props {
  token: string | null;
  apiUrl: string;
  transactions: Transaction[];
  fire: (t: string, b: string, type?: string) => void;
  onBack: () => void;
}

export function ScreenDisputes({ token, apiUrl, transactions, fire, onBack }: Props) {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchDisputes = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/api/disputes`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setDisputes(await res.json());
    } catch { /* offline */ }
  }, [token, apiUrl]);

  useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

  const submit = async () => {
    if (!selectedTxId || !reason) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/disputes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transactionId: selectedTxId, reason }),
      });
      if (res.ok) {
        fire('Dispute filed', 'Your dispute has been submitted for review.', 'success');
        setReportOpen(false);
        setSelectedTxId(''); setReason('');
        fetchDisputes();
      } else {
        const err = await res.json();
        fire('Error', err.error || 'Failed to file dispute.', 'error');
      }
    } catch { fire('Error', 'Failed to file dispute.', 'error'); }
    setLoading(false);
  };

  const statusColor = (s: string) => {
    if (s === 'resolved') return '#34d399';
    if (s === 'investigating') return THEME.colors.accent;
    if (s === 'rejected') return '#fb7185';
    return THEME.colors.text2;
  };

  const recentTxs = transactions.slice(0, 20);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 88 }}>
      <FadeSlideIn delay={0}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="arrowLeft" size={22} color={THEME.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Disputes</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setReportOpen(true)}>
            <Icon name="plus" size={18} color={THEME.colors.onAccent} />
          </TouchableOpacity>
        </View>
      </FadeSlideIn>

      {disputes.length === 0 ? (
        <FadeSlideIn delay={80}>
          <View style={styles.emptyCard}>
            <Icon name="shield" size={32} color={THEME.colors.text3} />
            <Text style={styles.emptyText}>No disputes filed</Text>
            <TouchableOpacity style={styles.ctaBtn} onPress={() => setReportOpen(true)}>
              <Text style={styles.ctaBtnText}>Report a transaction</Text>
            </TouchableOpacity>
          </View>
        </FadeSlideIn>
      ) : (
        disputes.map((d, i) => (
          <FadeSlideIn key={d.id} delay={i * 60}>
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{d.reason}</Text>
                <Text style={styles.cardSub}>Transaction: {d.transactionId.slice(0, 8)}...</Text>
                <Text style={[styles.cardStatus, { color: statusColor(d.status) }]}>{d.status.toUpperCase()}</Text>
                {d.resolution && <Text style={styles.cardSub}>Resolution: {d.resolution}</Text>}
              </View>
              <Text style={styles.cardDate}>{new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
            </View>
          </FadeSlideIn>
        ))
      )}

      <MobileSheet open={reportOpen} onClose={() => setReportOpen(false)} title="Report Transaction">
        <View style={{ gap: 12, paddingVertical: 4 }}>
          <Text style={{ color: THEME.colors.text2, fontSize: 13 }}>Select transaction</Text>
          <ScrollView style={{ maxHeight: 200 }}>
            {recentTxs.map(tx => (
              <TouchableOpacity
                key={tx.id}
                style={[styles.txItem, selectedTxId === tx.id && { borderColor: THEME.colors.accent, borderWidth: 2 }]}
                onPress={() => setSelectedTxId(tx.id)}
              >
                <Text style={styles.txDesc} numberOfLines={1}>{tx.description}</Text>
                <Text style={styles.txAmt}>{money(tx.amount)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
            placeholder="Reason for dispute"
            placeholderTextColor={THEME.colors.text3}
            value={reason}
            onChangeText={setReason}
            multiline
          />
          <TouchableOpacity style={[styles.ctaBtn, { marginTop: 8 }]} onPress={submit} disabled={loading}>
            <Text style={styles.ctaBtnText}>{loading ? 'Submitting...' : 'File Dispute'}</Text>
          </TouchableOpacity>
        </View>
      </MobileSheet>
    </ScrollView>
  );
}

const styles = themedSheet(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg, paddingHorizontal: 16, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: THEME.colors.text, flex: 1 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: THEME.colors.accent, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.regular, padding: 32, alignItems: 'center', gap: 12 },
  emptyText: { color: THEME.colors.text3, fontSize: 14 },
  ctaBtn: { backgroundColor: THEME.colors.accent, paddingVertical: 12, paddingHorizontal: 20, borderRadius: THEME.radius.regular, alignItems: 'center' },
  ctaBtnText: { color: THEME.colors.onAccent, fontWeight: '600', fontSize: 15 },
  card: { flexDirection: 'row', backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.regular, padding: 16, marginBottom: 10, alignItems: 'center' },
  cardTitle: { color: THEME.colors.text, fontWeight: '600', fontSize: 15 },
  cardSub: { color: THEME.colors.text2, fontSize: 12, marginTop: 2 },
  cardStatus: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  cardDate: { color: THEME.colors.text3, fontSize: 12 },
  input: { backgroundColor: THEME.colors.surface, color: THEME.colors.text, borderRadius: THEME.radius.regular, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: THEME.colors.text3 + '33' },
  txItem: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.regular, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: THEME.colors.text3 + '33' },
  txDesc: { color: THEME.colors.text, fontSize: 13, flex: 1 },
  txAmt: { color: THEME.colors.text2, fontSize: 13, fontWeight: '600' },
}));
