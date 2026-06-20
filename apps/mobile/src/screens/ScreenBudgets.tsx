import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Icon } from '../components/Icon';
import { money } from '../components/UI';
import { MobileSheet } from '../components/MobileExtras';
import { FadeSlideIn, AnimatedProgressBar } from '../components/Motion';
import { THEME, themedSheet } from '../theme';

interface Budget {
  id: string;
  category: string;
  monthlyLimit: number;
  currentSpend: number;
  alertThreshold: number;
  month: string;
}

interface Props {
  token: string | null;
  apiUrl: string;
  fire: (t: string, b: string, type?: string) => void;
}

const CATEGORIES = ['Groceries', 'Dining', 'Transport', 'Shopping', 'Entertainment', 'Bills', 'Health', 'Other'];

export function ScreenBudgets({ token, apiUrl, fire }: Props) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [category, setCategory] = useState('Groceries');
  const [limit, setLimit] = useState('');
  const [loading, setLoading] = useState(false);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const fetchBudgets = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/api/budgets?month=${currentMonth}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setBudgets(await res.json());
    } catch { /* offline */ }
  }, [token, apiUrl, currentMonth]);

  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);

  const create = async () => {
    const val = parseFloat(limit);
    if (!val || val <= 0) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/budgets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ category, monthlyLimit: val, month: currentMonth }),
      });
      if (res.ok) {
        fire('Budget set', `${category} budget: ${money(val)} / month.`, 'success');
        setCreateOpen(false);
        setLimit('');
        fetchBudgets();
      }
    } catch { fire('Error', 'Failed to create budget.', 'error'); }
    setLoading(false);
  };

  const remove = async (id: string) => {
    try {
      await fetch(`${apiUrl}/api/budgets/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      fire('Removed', 'Budget removed.', 'success');
      fetchBudgets();
    } catch { fire('Error', 'Failed to remove.', 'error'); }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 88 }}>
      <FadeSlideIn delay={0}>
        <View style={styles.header}>
          <Text style={styles.title}>Budgets</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setCreateOpen(true)}>
            <Icon name="plus" size={18} color={THEME.colors.onAccent} />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
      </FadeSlideIn>

      {budgets.length === 0 ? (
        <FadeSlideIn delay={80}>
          <View style={styles.emptyCard}>
            <Icon name="chart" size={32} color={THEME.colors.text3} />
            <Text style={styles.emptyText}>No budgets set for this month</Text>
            <TouchableOpacity style={styles.ctaBtn} onPress={() => setCreateOpen(true)}>
              <Text style={styles.ctaBtnText}>Set a budget</Text>
            </TouchableOpacity>
          </View>
        </FadeSlideIn>
      ) : (
        budgets.map((b, i) => {
          const pct = b.monthlyLimit > 0 ? Math.min(b.currentSpend / b.monthlyLimit, 1) : 0;
          const over = b.currentSpend > b.monthlyLimit;
          return (
            <FadeSlideIn key={b.id} delay={i * 60}>
              <View style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={styles.cardTitle}>{b.category}</Text>
                  <TouchableOpacity onPress={() => remove(b.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="trash" size={16} color={THEME.colors.text3} />
                  </TouchableOpacity>
                </View>
                <AnimatedProgressBar pct={pct} color={over ? '#fb7185' : THEME.colors.accent} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                  <Text style={[styles.cardSub, over && { color: '#fb7185' }]}>{money(b.currentSpend)} spent</Text>
                  <Text style={styles.cardSub}>{money(b.monthlyLimit)} limit</Text>
                </View>
              </View>
            </FadeSlideIn>
          );
        })
      )}

      <MobileSheet open={createOpen} onClose={() => setCreateOpen(false)} title="Set Budget">
        <View style={{ gap: 12, paddingVertical: 4 }}>
          <Text style={{ color: THEME.colors.text2, fontSize: 13 }}>Category</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(c => (
              <TouchableOpacity key={c} style={[styles.catChip, category === c && { backgroundColor: THEME.colors.accent }]} onPress={() => setCategory(c)}>
                <Text style={[styles.catChipText, category === c && { color: THEME.colors.onAccent }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.input} placeholder="Monthly limit" placeholderTextColor={THEME.colors.text3} value={limit} onChangeText={setLimit} keyboardType="decimal-pad" />
          <TouchableOpacity style={[styles.ctaBtn, { marginTop: 8 }]} onPress={create} disabled={loading}>
            <Text style={styles.ctaBtnText}>{loading ? 'Saving...' : 'Set Budget'}</Text>
          </TouchableOpacity>
        </View>
      </MobileSheet>
    </ScrollView>
  );
}

const styles = themedSheet(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg, paddingHorizontal: 16, paddingTop: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: THEME.colors.text },
  subtitle: { color: THEME.colors.text2, fontSize: 13, marginTop: 2, marginBottom: 16 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: THEME.colors.accent, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.regular, padding: 32, alignItems: 'center', gap: 12 },
  emptyText: { color: THEME.colors.text3, fontSize: 14 },
  ctaBtn: { backgroundColor: THEME.colors.accent, paddingVertical: 12, paddingHorizontal: 20, borderRadius: THEME.radius.regular, alignItems: 'center' },
  ctaBtnText: { color: THEME.colors.onAccent, fontWeight: '600', fontSize: 15 },
  card: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.regular, padding: 16, marginBottom: 10 },
  cardTitle: { color: THEME.colors.text, fontWeight: '600', fontSize: 15 },
  cardSub: { color: THEME.colors.text2, fontSize: 12 },
  input: { backgroundColor: THEME.colors.surface, color: THEME.colors.text, borderRadius: THEME.radius.regular, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: THEME.colors.text3 + '33' },
  catChip: { backgroundColor: THEME.colors.surface, paddingVertical: 8, paddingHorizontal: 12, borderRadius: THEME.radius.regular, borderWidth: 1, borderColor: THEME.colors.text3 + '33' },
  catChipText: { color: THEME.colors.text2, fontSize: 13, fontWeight: '600' },
}));
