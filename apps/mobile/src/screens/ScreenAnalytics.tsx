import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform } from 'react-native';
import { Icon } from '../components/Icon';
import { money, catColor, Donut, Bars, CategoryIcon, Delta } from '../components/UI';
import { THEME } from '../theme';
import type { AppData } from '../../App';

interface AnalyticsProps {
  data: AppData;
}

export function ScreenAnalytics({ data }: AnalyticsProps) {
  const [budget, setBudget] = useState(2000);
  const [budgetEditing, setBudgetEditing] = useState(false);
  const [budgetInput, setBudgetInput] = useState('2000');

  const cats = [...data.spendByCat].sort((a, b) => b.amount - a.amount);
  const total = cats.reduce((s, c) => s + c.amount, 0);
  const totalSaved = data.goals.reduce((s, g) => s + g.saved, 0);

  const prevMonth = data.monthly[data.monthly.length - 2] || { in: 0, out: 0 };
  const spentDelta = prevMonth.out > 0
    ? parseFloat(((total - prevMonth.out) / prevMonth.out * 100).toFixed(1))
    : 0;
  const daysElapsed = new Date().getDate();
  const avgDay = daysElapsed > 0 ? total / daysElapsed : 0;
  const prevAvgDay = prevMonth.out > 0 ? prevMonth.out / 30 : 0;
  const avgDayDelta = prevAvgDay > 0
    ? parseFloat(((avgDay - prevAvgDay) / prevAvgDay * 100).toFixed(1))
    : 0;
  const totalTarget = data.goals.reduce((s, g) => s + g.target, 0);
  const savedPct = totalTarget > 0
    ? parseFloat(((totalSaved / totalTarget) * 100).toFixed(1))
    : 0;

  const topMerchants = useMemo(() => {
    const myWalletIds = new Set(data.wallets.map((w: any) => w.id));
    const sums: Record<string, { name: string; cat: string; amount: number }> = {};
    data.transactions.forEach((t: any) => {
      if (!t.senderWalletId || !myWalletIds.has(t.senderWalletId)) return;
      const desc = t.description || 'Other';
      const lower = desc.toLowerCase();
      let merchant = desc;
      let cat = 'other';
      if (lower.includes('albert') || lower.includes('ah') || lower.includes('heijn')) { merchant = 'Albert Heijn'; cat = 'groceries'; }
      else if (lower.includes('uber') || lower.includes('taxi') || lower.includes('transport')) { merchant = 'Uber'; cat = 'transport'; }
      else if (lower.includes('spotify') || lower.includes('netflix') || lower.includes('youtube') || lower.includes('premium')) { cat = 'subs'; }
      else if (lower.includes('brussels') || lower.includes('airline') || lower.includes('flight')) { merchant = 'Brussels Airlines'; cat = 'travel'; }
      else if (lower.includes('amazon') || lower.includes('bol') || lower.includes('shopping')) { cat = 'shopping'; }
      else if (lower.includes('invoice') || lower.includes('bill') || lower.includes('utilities')) { cat = 'bills'; }
      const amt = typeof t.amount === 'number' ? t.amount : parseFloat(String(t.amount)) || 0;
      if (!sums[merchant]) sums[merchant] = { name: merchant, cat, amount: 0 };
      sums[merchant].amount += amt;
    });
    const sorted = Object.values(sums).sort((a, b) => b.amount - a.amount).slice(0, 3);
    return sorted.length > 0 ? sorted : [
      { name: 'Albert Heijn', cat: 'groceries', amount: 142 },
      { name: 'Brussels Airlines', cat: 'travel', amount: 214 },
      { name: 'Bol.com', cat: 'shopping', amount: 145 },
    ];
  }, [data.transactions, data.wallets]);

  const STATS = [
    { label: 'Total spent',  value: money(total),                       delta: spentDelta,   icon: 'trend'  },
    { label: 'vs budget',    value: `${Math.round((total/budget)*100)}%`, sub: `of ${money(budget).replace('.00','')}`, icon: 'target' },
    { label: 'Avg / day',    value: money(avgDay).replace('.00', '.0'),  delta: avgDayDelta,  icon: 'clock'  },
    { label: 'Saved',        value: money(totalSaved),                   sub: `${savedPct}% of goals`,       icon: 'flame'  },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Insights</Text>
        <Text style={styles.subtitle}>Where your money goes.</Text>
      </View>

      {/* Stat cards 2x2 */}
      <View style={styles.statsGrid}>
        {STATS.map(s => (
          <View key={s.label} style={[styles.card, styles.statCard]}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Icon name={s.icon} size={14} color={THEME.colors.text3} />
            </View>
            <Text style={styles.statValue}>{s.value}</Text>
            <View style={{ marginTop: 4 }}>
              {s.delta !== undefined
                ? <Delta value={s.delta} />
                : <Text style={styles.statSub}>{s.sub}</Text>}
            </View>
          </View>
        ))}
      </View>

      {/* Spending by category donut */}
      {cats.length > 0 && (
        <View style={[styles.card, styles.section]}>
          <Text style={styles.sectionTitle}>By category</Text>
          <View style={styles.donutRow}>
            <Donut size={148} thickness={20} segments={cats.map(c => ({ value: c.amount, color: catColor(c.hue) }))}>
              <Text style={styles.donutTotal}>{money(total).replace('.00', '')}</Text>
              <Text style={styles.donutSub}>spent</Text>
            </Donut>
            <View style={styles.legend}>
              {cats.map(c => {
                const pct = total > 0 ? Math.round((c.amount / total) * 100) : 0;
                return (
                  <View key={c.cat} style={styles.legendRow}>
                    <View style={[styles.dot, { backgroundColor: catColor(c.hue) }]} />
                    <Text style={styles.legendLabel} numberOfLines={1}>{c.label}</Text>
                    <Text style={styles.legendAmt}>{pct}%</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* Cash flow bars */}
      <View style={[styles.card, styles.section]}>
        <View style={styles.cashFlowHeader}>
          <Text style={styles.sectionTitle}>Cash flow</Text>
          <View style={styles.cashFlowLegend}>
            <View style={[styles.legendDot, { backgroundColor: THEME.colors.accent }]} />
            <Text style={styles.cashFlowLegendText}>In</Text>
            <View style={[styles.legendDot, { backgroundColor: THEME.colors.text3 }]} />
            <Text style={styles.cashFlowLegendText}>Out</Text>
          </View>
        </View>
        <Bars data={data.monthly} h={120} />
      </View>

      {/* Monthly budget */}
      <View style={[styles.card, styles.section]}>
        <View style={styles.budgetHeader}>
          <Text style={styles.sectionTitle}>Monthly budget</Text>
          {budgetEditing ? (
            <View style={styles.budgetEditRow}>
              <TextInput
                style={styles.budgetInput}
                value={budgetInput}
                onChangeText={v => setBudgetInput(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                autoFocus
                onBlur={() => {
                  const v = parseFloat(budgetInput);
                  if (v > 0) setBudget(v);
                  setBudgetEditing(false);
                }}
              />
              <TouchableOpacity onPress={() => { const v = parseFloat(budgetInput); if (v > 0) setBudget(v); setBudgetEditing(false); }}>
                <Text style={styles.budgetSave}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => { setBudgetInput(String(budget)); setBudgetEditing(true); }} style={styles.budgetDisplay}>
              <Text style={styles.budgetText}>{money(total).replace('.00','')} / {money(budget).replace('.00','')}</Text>
              <Icon name="edit" size={12} color={THEME.colors.text3} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, {
            width: `${Math.min(100, (total / budget) * 100)}%` as any,
            backgroundColor: total > budget ? THEME.colors.neg : THEME.colors.accent,
          }]} />
        </View>
        <Text style={styles.budgetNote}>
          {total > budget
            ? `${money(total - budget).replace('.00','')} over budget this month`
            : `${money(budget - total).replace('.00','')} under budget · ${31 - new Date().getDate()} days left`}
        </Text>
      </View>

      {/* Top merchants */}
      <View style={[styles.card, styles.section]}>
        <Text style={styles.sectionTitle}>Top merchants</Text>
        {topMerchants.map(m => (
          <View key={m.name} style={styles.merchantRow}>
            <CategoryIcon cat={m.cat} size={38} />
            <Text style={styles.merchantName}>{m.name}</Text>
            <Text style={styles.merchantAmt}>{money(m.amount)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: 16, gap: 16, paddingBottom: 88 },
  header: { paddingBottom: 4 },
  title: { fontSize: 24, fontWeight: 'bold', color: THEME.colors.text },
  subtitle: { fontSize: 13, color: THEME.colors.text3, marginTop: 2 },
  card: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.line, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flex: 1, flexBasis: '47%', padding: 16 },
  statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { fontSize: 11, fontWeight: 'bold', color: THEME.colors.text3, textTransform: 'uppercase', letterSpacing: 0.8 },
  statValue: { fontSize: 20, fontWeight: 'bold', color: THEME.colors.text, marginTop: 8, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
  statSub: { fontSize: 11, color: THEME.colors.text3 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: THEME.colors.text, marginBottom: 14, letterSpacing: -0.2 },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  donutTotal: { fontSize: 16, fontWeight: 'bold', color: THEME.colors.text, textAlign: 'center' },
  donutSub: { fontSize: 10, color: THEME.colors.text3, textAlign: 'center' },
  legend: { flex: 1, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { flex: 1, fontSize: 13, color: THEME.colors.text2, fontWeight: '600' },
  legendAmt: { fontSize: 12, color: THEME.colors.text3, fontFamily: 'monospace' },
  cashFlowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cashFlowLegend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cashFlowLegendText: { fontSize: 11, color: THEME.colors.text3 },
  legendDot: { width: 8, height: 8, borderRadius: 3 },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  budgetDisplay: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  budgetText: { fontSize: 13, color: THEME.colors.text2, fontFamily: 'monospace' },
  budgetEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  budgetInput: { borderWidth: 1, borderColor: THEME.colors.accentLine, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, color: THEME.colors.text, fontSize: 13, width: 100, backgroundColor: THEME.colors.surface2 },
  budgetSave: { color: THEME.colors.accent, fontWeight: 'bold', fontSize: 13 },
  progressTrack: { height: 10, borderRadius: 99, backgroundColor: THEME.colors.surface2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99 },
  budgetNote: { marginTop: 10, fontSize: 13, color: THEME.colors.text2 },
  merchantRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: THEME.colors.line },
  merchantName: { flex: 1, fontSize: 14, fontWeight: '600', color: THEME.colors.text },
  merchantAmt: { fontSize: 14, fontWeight: 'bold', color: THEME.colors.text, fontFamily: 'monospace' },
});
