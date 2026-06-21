import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from '../components/Icon';
import { money } from '../components/UI';
import { FadeSlideIn } from '../components/Motion';
import { THEME, themedSheet } from '../theme';

interface Receipt {
  id: string;
  transactionRef: string;
  payerEmail: string;
  payeeEmail?: string;
  amount: number;
  currency: string;
  description: string;
  createdAt: string;
}

interface PaymentRequest {
  id: string;
  creatorEmail: string;
  recipientEmail: string;
  amount: number;
  currency: string;
  description: string;
  status: string;
  createdAt: string;
}

interface Props {
  token: string | null;
  apiUrl: string;
  fire: (t: string, b: string, type?: string) => void;
  onBack: () => void;
}

export function ScreenInvoices({ token, apiUrl, fire, onBack }: Props) {
  const [tab, setTab] = useState<'receipts' | 'requests'>('receipts');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [rRes, pRes] = await Promise.all([
        fetch(`${apiUrl}/api/invoices/receipts`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiUrl}/api/invoices/payment-requests`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (rRes.ok) setReceipts(await rRes.json());
      if (pRes.ok) setRequests(await pRes.json());
    } catch { /* offline */ }
  }, [token, apiUrl]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusColor = (s: string) => {
    if (s === 'paid') return '#34d399';
    if (s === 'pending') return THEME.colors.accent;
    if (s === 'declined' || s === 'expired') return '#fb7185';
    return THEME.colors.text3;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 88 }}>
      <FadeSlideIn delay={0}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="arrowLeft" size={22} color={THEME.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Invoices & Receipts</Text>
        </View>
      </FadeSlideIn>

      <FadeSlideIn delay={40}>
        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === 'receipts' && styles.tabActive]} onPress={() => setTab('receipts')}>
            <Text style={[styles.tabText, tab === 'receipts' && styles.tabTextActive]}>Receipts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'requests' && styles.tabActive]} onPress={() => setTab('requests')}>
            <Text style={[styles.tabText, tab === 'requests' && styles.tabTextActive]}>Payment Requests</Text>
          </TouchableOpacity>
        </View>
      </FadeSlideIn>

      {tab === 'receipts' ? (
        receipts.length === 0 ? (
          <FadeSlideIn delay={80}>
            <View style={styles.emptyCard}>
              <Icon name="file" size={32} color={THEME.colors.text3} />
              <Text style={styles.emptyText}>No receipts yet</Text>
            </View>
          </FadeSlideIn>
        ) : (
          receipts.map((r, i) => (
            <FadeSlideIn key={r.id} delay={i * 50}>
              <View style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{r.description}</Text>
                  <Text style={styles.cardSub}>Ref: {r.transactionRef}</Text>
                  <Text style={styles.cardSub}>{new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                </View>
                <Text style={styles.cardAmount}>{money(r.amount, r.currency)}</Text>
              </View>
            </FadeSlideIn>
          ))
        )
      ) : (
        requests.length === 0 ? (
          <FadeSlideIn delay={80}>
            <View style={styles.emptyCard}>
              <Icon name="inbox" size={32} color={THEME.colors.text3} />
              <Text style={styles.emptyText}>No payment requests</Text>
            </View>
          </FadeSlideIn>
        ) : (
          requests.map((r, i) => (
            <FadeSlideIn key={r.id} delay={i * 50}>
              <View style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{r.description}</Text>
                  <Text style={styles.cardSub}>From: {r.creatorEmail}</Text>
                  <Text style={[styles.cardStatus, { color: statusColor(r.status) }]}>{r.status.toUpperCase()}</Text>
                </View>
                <Text style={styles.cardAmount}>{money(r.amount, r.currency)}</Text>
              </View>
            </FadeSlideIn>
          ))
        )
      )}
    </ScrollView>
  );
}

const styles = themedSheet(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 24, fontWeight: '700', color: THEME.colors.text, flex: 1, letterSpacing: -0.5 },
  tabs: { flexDirection: 'row', backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.line, padding: 4, marginBottom: 16, marginHorizontal: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: THEME.radius.regular },
  tabActive: { backgroundColor: THEME.colors.accent, shadowColor: THEME.colors.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
  tabText: { color: THEME.colors.text3, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: THEME.colors.onAccent, fontWeight: '700' },
  emptyCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.line, padding: 40, alignItems: 'center', gap: 14, marginHorizontal: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  emptyText: { color: THEME.colors.text3, fontSize: 14 },
  card: { flexDirection: 'row', backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.line, padding: 16, marginBottom: 8, marginHorizontal: 16, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  cardTitle: { color: THEME.colors.text, fontWeight: '700', fontSize: 15, letterSpacing: -0.2 },
  cardSub: { color: THEME.colors.text2, fontSize: 12, marginTop: 3, letterSpacing: 0.1 },
  cardStatus: { fontSize: 10, fontWeight: '800', marginTop: 6, letterSpacing: 1 },
  cardAmount: { color: THEME.colors.text, fontWeight: '700', fontSize: 17, letterSpacing: -0.5 },
}));
