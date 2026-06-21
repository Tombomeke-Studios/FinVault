import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Icon } from '../components/Icon';
import { money } from '../components/UI';
import { FadeSlideIn } from '../components/Motion';
import { THEME, themedSheet } from '../theme';

interface Mandate {
  id: string;
  payeeEmail: string;
  amount: number;
  currency: string;
  description: string;
  intervalDays: number;
  status: string;
  nextChargeAt: string;
  totalCharged: number;
  chargeCount: number;
}

interface Props {
  token: string | null;
  apiUrl: string;
  fire: (t: string, b: string, type?: string) => void;
  onBack: () => void;
}

export function ScreenMandates({ token, apiUrl, fire, onBack }: Props) {
  const [mandates, setMandates] = useState<Mandate[]>([]);

  const fetchMandates = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/api/invoices/mandates`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setMandates(await res.json());
    } catch { /* offline */ }
  }, [token, apiUrl]);

  useEffect(() => { fetchMandates(); }, [fetchMandates]);

  const cancelMandate = (id: string) => {
    Alert.alert('Cancel Direct Debit', 'Are you sure you want to cancel this mandate?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Mandate', style: 'destructive', onPress: async () => {
          try {
            const res = await fetch(`${apiUrl}/api/invoices/mandates/${id}/cancel`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              fire('Cancelled', 'Direct debit mandate cancelled.', 'success');
              fetchMandates();
            }
          } catch { fire('Error', 'Failed to cancel mandate.', 'error'); }
        }
      }
    ]);
  };

  const intervalLabel = (days: number) => {
    if (days <= 1) return 'Daily';
    if (days === 7) return 'Weekly';
    if (days === 30) return 'Monthly';
    if (days === 365) return 'Yearly';
    return `Every ${days} days`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 88 }}>
      <FadeSlideIn delay={0}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="arrowLeft" size={22} color={THEME.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Direct Debits</Text>
        </View>
      </FadeSlideIn>

      {mandates.length === 0 ? (
        <FadeSlideIn delay={80}>
          <View style={styles.emptyCard}>
            <Icon name="repeat" size={32} color={THEME.colors.text3} />
            <Text style={styles.emptyText}>No active direct debits</Text>
          </View>
        </FadeSlideIn>
      ) : (
        mandates.map((m, i) => (
          <FadeSlideIn key={m.id} delay={i * 60}>
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{m.description || m.payeeEmail}</Text>
                <Text style={styles.cardSub}>{intervalLabel(m.intervalDays)} · {m.chargeCount} charges</Text>
                <Text style={styles.cardSub}>Next: {new Date(m.nextChargeAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                <Text style={[styles.cardStatus, m.status === 'active' ? { color: THEME.colors.accent } : { color: THEME.colors.text3 }]}>
                  {m.status.toUpperCase()}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={styles.cardAmount}>{money(m.amount)}</Text>
                <Text style={styles.cardSub}>Total: {money(m.totalCharged)}</Text>
                {m.status === 'active' && (
                  <TouchableOpacity onPress={() => cancelMandate(m.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ color: '#fb7185', fontSize: 12, fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </FadeSlideIn>
        ))
      )}
    </ScrollView>
  );
}

const styles = themedSheet(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 24, fontWeight: '700', color: THEME.colors.text, flex: 1, letterSpacing: -0.5 },
  emptyCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.line, padding: 40, alignItems: 'center', gap: 14, marginHorizontal: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  emptyText: { color: THEME.colors.text3, fontSize: 14 },
  card: { flexDirection: 'row', backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.line, padding: 16, marginBottom: 10, marginHorizontal: 16, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  cardTitle: { color: THEME.colors.text, fontWeight: '700', fontSize: 15, letterSpacing: -0.2 },
  cardSub: { color: THEME.colors.text2, fontSize: 12, marginTop: 3, letterSpacing: 0.1 },
  cardStatus: { fontSize: 10, fontWeight: '800', marginTop: 6, letterSpacing: 1 },
  cardAmount: { color: THEME.colors.text, fontWeight: '700', fontSize: 17, letterSpacing: -0.5 },
}));
