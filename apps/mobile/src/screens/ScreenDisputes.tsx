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
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 24, fontWeight: '700', color: THEME.colors.text, flex: 1, letterSpacing: -0.5 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: THEME.colors.accent, alignItems: 'center', justifyContent: 'center', shadowColor: THEME.colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  emptyCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.line, padding: 40, alignItems: 'center', gap: 14, marginHorizontal: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  emptyText: { color: THEME.colors.text3, fontSize: 14 },
  ctaBtn: { backgroundColor: THEME.colors.accent, paddingVertical: 14, paddingHorizontal: 24, borderRadius: THEME.radius.regular, alignItems: 'center', shadowColor: THEME.colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  ctaBtnText: { color: THEME.colors.onAccent, fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
  card: { flexDirection: 'row', backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.line, padding: 16, marginBottom: 10, marginHorizontal: 16, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  cardTitle: { color: THEME.colors.text, fontWeight: '700', fontSize: 15, letterSpacing: -0.2 },
  cardSub: { color: THEME.colors.text2, fontSize: 12, marginTop: 3, letterSpacing: 0.1 },
  cardStatus: { fontSize: 10, fontWeight: '800', marginTop: 6, letterSpacing: 1 },
  cardDate: { color: THEME.colors.text3, fontSize: 12, letterSpacing: 0.2 },
  input: { backgroundColor: THEME.colors.surface, color: THEME.colors.text, borderRadius: THEME.radius.regular, borderWidth: 1, borderColor: THEME.colors.line, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  txItem: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.regular, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: THEME.colors.line },
  txDesc: { color: THEME.colors.text, fontSize: 13, flex: 1, letterSpacing: -0.1 },
  txAmt: { color: THEME.colors.text2, fontSize: 13, fontWeight: '700' },
}));
