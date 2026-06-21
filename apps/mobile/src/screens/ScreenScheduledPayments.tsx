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
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: THEME.colors.text, letterSpacing: -0.5 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: THEME.colors.accent, alignItems: 'center', justifyContent: 'center', shadowColor: THEME.colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  emptyCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.line, padding: 40, alignItems: 'center', gap: 14, marginHorizontal: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  emptyText: { color: THEME.colors.text3, fontSize: 14, letterSpacing: 0.1 },
  ctaBtn: { backgroundColor: THEME.colors.accent, paddingVertical: 14, paddingHorizontal: 24, borderRadius: THEME.radius.regular, alignItems: 'center', shadowColor: THEME.colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  ctaBtnText: { color: THEME.colors.onAccent, fontWeight: '700', fontSize: 15, letterSpacing: 0.3 },
  card: { flexDirection: 'row', backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.line, padding: 16, marginBottom: 10, marginHorizontal: 16, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  cardTitle: { color: THEME.colors.text, fontWeight: '600', fontSize: 15, letterSpacing: -0.2 },
  cardSub: { color: THEME.colors.text2, fontSize: 12, marginTop: 3, letterSpacing: 0.1 },
  cardStatus: { fontSize: 10, fontWeight: '800', marginTop: 6, letterSpacing: 1 },
  cardAmount: { color: THEME.colors.text, fontWeight: '700', fontSize: 17, letterSpacing: -0.5 },
  input: { backgroundColor: THEME.colors.surface, color: THEME.colors.text, borderRadius: THEME.radius.regular, borderWidth: 1, borderColor: THEME.colors.line, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  freqChip: { backgroundColor: THEME.colors.surface, borderWidth: 1, borderColor: THEME.colors.line, paddingVertical: 8, paddingHorizontal: 14, borderRadius: THEME.radius.pill },
  freqText: { color: THEME.colors.text2, fontSize: 13, fontWeight: '600' },
}));
