import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Icon } from '../components/Icon';
import { money } from '../components/UI';
import { MobileSheet } from '../components/MobileExtras';
import { FadeSlideIn } from '../components/Motion';
import { THEME, themedSheet } from '../theme';

interface ScheduledPayment {
  id: string;
  sourceWalletId: string;
  targetEmail?: string | null;
  targetIban?: string | null;
  targetName: string;
  amount: number;
  currency: string;
  description: string;
  frequency: string;
  nextRunAt: string;
  status: string;
}

interface Props {
  token: string | null;
  apiUrl: string;
  wallets: { id: string; type: string; iban: string }[];
  fire: (t: string, b: string, type?: string) => void;
}

export function ScreenScheduledPayments({ token, apiUrl, wallets, fire }: Props) {
  const [payments, setPayments] = useState<ScheduledPayment[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [targetName, setTargetName] = useState('');
  const [amt, setAmt] = useState('');
  const [desc, setDesc] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [loading, setLoading] = useState(false);

  const fetchPayments = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/api/scheduled-payments`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setPayments(await res.json());
    } catch { /* offline fallback */ }
  }, [token, apiUrl]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const create = async () => {
    const val = parseFloat(amt);
    if (!target || !val || val <= 0) return;
    setLoading(true);
    try {
      const isIban = /^[A-Z]{2}\d{2}/.test(target.replace(/\s/g, '').toUpperCase());
      const body: any = {
        sourceWalletId: wallets.find(w => w.type === 'checking')?.id || wallets[0]?.id,
        amount: val,
        description: desc || 'Scheduled payment',
        frequency,
        nextRunAt: new Date(Date.now() + 86400000).toISOString(),
        targetName,
      };
      if (isIban) body.targetIban = target.replace(/\s/g, '').toUpperCase();
      else body.targetEmail = target.trim().toLowerCase();

      const res = await fetch(`${apiUrl}/api/scheduled-payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        fire('Scheduled', `Payment of ${money(val)} scheduled ${frequency}.`, 'success');
        setCreateOpen(false);
        setTarget(''); setTargetName(''); setAmt(''); setDesc('');
        fetchPayments();
      }
    } catch { fire('Error', 'Failed to create scheduled payment.', 'error'); }
    setLoading(false);
  };

  const cancel = async (id: string) => {
    try {
      await fetch(`${apiUrl}/api/scheduled-payments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'completed' }),
      });
      fire('Cancelled', 'Scheduled payment cancelled.', 'success');
      fetchPayments();
    } catch { fire('Error', 'Failed to cancel.', 'error'); }
  };

  const freqLabel = (f: string) => f === 'once' ? 'One-time' : f.charAt(0).toUpperCase() + f.slice(1);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 88 }}>
      <FadeSlideIn delay={0}>
        <View style={styles.header}>
          <Text style={styles.title}>Scheduled Payments</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setCreateOpen(true)}>
            <Icon name="plus" size={18} color={THEME.colors.onAccent} />
          </TouchableOpacity>
        </View>
      </FadeSlideIn>

      {payments.length === 0 ? (
        <FadeSlideIn delay={80}>
          <View style={styles.emptyCard}>
            <Icon name="calendar" size={32} color={THEME.colors.text3} />
            <Text style={styles.emptyText}>No scheduled payments yet</Text>
            <TouchableOpacity style={styles.ctaBtn} onPress={() => setCreateOpen(true)}>
              <Text style={styles.ctaBtnText}>Create one</Text>
            </TouchableOpacity>
          </View>
        </FadeSlideIn>
      ) : (
        payments.map((p, i) => (
          <FadeSlideIn key={p.id} delay={i * 60}>
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{p.targetName || p.targetEmail || p.targetIban}</Text>
                <Text style={styles.cardSub}>{freqLabel(p.frequency)} · {p.description}</Text>
                <Text style={[styles.cardStatus, p.status === 'active' ? { color: THEME.colors.accent } : { color: THEME.colors.text3 }]}>
                  {p.status.toUpperCase()}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={styles.cardAmount}>{money(p.amount)}</Text>
                {p.status === 'active' && (
                  <TouchableOpacity onPress={() => cancel(p.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ color: '#fb7185', fontSize: 12, fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </FadeSlideIn>
        ))
      )}

      <MobileSheet open={createOpen} onClose={() => setCreateOpen(false)} title="New Scheduled Payment">
        <View style={{ gap: 12, paddingVertical: 4 }}>
          <TextInput style={styles.input} placeholder="Recipient (email or IBAN)" placeholderTextColor={THEME.colors.text3} value={target} onChangeText={setTarget} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Recipient name (optional)" placeholderTextColor={THEME.colors.text3} value={targetName} onChangeText={setTargetName} />
          <TextInput style={styles.input} placeholder="Amount" placeholderTextColor={THEME.colors.text3} value={amt} onChangeText={setAmt} keyboardType="decimal-pad" />
          <TextInput style={styles.input} placeholder="Description" placeholderTextColor={THEME.colors.text3} value={desc} onChangeText={setDesc} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {['once', 'daily', 'weekly', 'monthly'].map(f => (
              <TouchableOpacity key={f} style={[styles.freqChip, frequency === f && { backgroundColor: THEME.colors.accent }]} onPress={() => setFrequency(f)}>
                <Text style={[styles.freqText, frequency === f && { color: THEME.colors.onAccent }]}>{freqLabel(f)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.ctaBtn, { marginTop: 8 }]} onPress={create} disabled={loading}>
            <Text style={styles.ctaBtnText}>{loading ? 'Creating...' : 'Schedule Payment'}</Text>
          </TouchableOpacity>
        </View>
      </MobileSheet>
    </ScrollView>
  );
}

const styles = themedSheet(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg, paddingHorizontal: 16, paddingTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: THEME.colors.text },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: THEME.colors.accent, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.regular, padding: 32, alignItems: 'center', gap: 12 },
  emptyText: { color: THEME.colors.text3, fontSize: 14 },
  ctaBtn: { backgroundColor: THEME.colors.accent, paddingVertical: 12, paddingHorizontal: 20, borderRadius: THEME.radius.regular, alignItems: 'center' },
  ctaBtnText: { color: THEME.colors.onAccent, fontWeight: '600', fontSize: 15 },
  card: { flexDirection: 'row', backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.regular, padding: 16, marginBottom: 10, alignItems: 'center' },
  cardTitle: { color: THEME.colors.text, fontWeight: '600', fontSize: 15 },
  cardSub: { color: THEME.colors.text2, fontSize: 12, marginTop: 2 },
  cardStatus: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  cardAmount: { color: THEME.colors.text, fontWeight: '700', fontSize: 16 },
  input: { backgroundColor: THEME.colors.surface, color: THEME.colors.text, borderRadius: THEME.radius.regular, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  freqChip: { backgroundColor: THEME.colors.surface, paddingVertical: 8, paddingHorizontal: 12, borderRadius: THEME.radius.regular },
  freqText: { color: THEME.colors.text2, fontSize: 13, fontWeight: '600' },
}));
