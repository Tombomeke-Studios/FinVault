import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Icon } from '../components/Icon';
import { money, Sparkline, relTime, CategoryIcon, Ring, catColor, Delta } from '../components/UI';
import { BankCard } from '../components/BankCard';
import { PressableScale, FadeSlideIn, AnimatedProgressBar } from '../components/Motion';
import { THEME } from '../theme';
import type { AppData } from '../../App';

interface OverviewProps {
  navigate: (r: string) => void;
  data: AppData;
  onTopup: () => void;
}

const QUICK_ACTIONS = [
  { icon: 'send',  label: 'Send',    primary: true,  route: 'transfer' },
  { icon: 'qr',   label: 'Request', primary: false, route: 'transfer' },
  { icon: 'plus', label: 'Top up',  primary: false, route: '' },
  { icon: 'bolt', label: 'Bills',   primary: false, route: 'transfer' },
];

// Account-card width + gap; keeps the horizontal carousel snapping exactly
// one card per swipe.
const ACCOUNT_CARD_W = 222;
const ACCOUNT_CARD_GAP = 12;

export function ScreenOverview({ navigate, data, onTopup }: OverviewProps) {

  const { wallets, transactions, cards, goals, spendByCat, balanceTrend, monthly } = data;

  const totalEUR = wallets.filter((w: any) => w.currency === 'EUR').reduce((s: number, w: any) => s + w.balance, 0);
  const recent = transactions.slice(0, 5);
  const card = cards[0];
  const goalsPreview = goals.slice(0, 2);
  const topCats = [...spendByCat].sort((a, b) => b.amount - a.amount).slice(0, 4);
  const totalSpend = topCats.reduce((s, c) => s + c.amount, 0);

  const currentMonthFlow = monthly[monthly.length - 1] || { in: 0, out: 0 };
  const prevBal = balanceTrend.length >= 2 ? balanceTrend[balanceTrend.length - 2] : balanceTrend[0] ?? 0;
  const currBal = balanceTrend[balanceTrend.length - 1] ?? totalEUR;
  const deltaBalance = prevBal > 0 ? parseFloat(((currBal - prevBal) / prevBal * 100).toFixed(1)) : 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ── Greeting ── */}
      <FadeSlideIn style={styles.greeting} distance={10}>
        <View>
          <Text style={styles.greetingLabel}>{greeting}</Text>
          <Text style={styles.greetingName}>{data.user.firstName}</Text>
        </View>
        <View style={styles.planBadge}>
          <Icon name="sparkle" size={11} color={THEME.colors.accent} />
          <Text style={styles.planText}>{data.user.plan.replace('FinVault ', '')}</Text>
        </View>
      </FadeSlideIn>

      {/* ── Hero balance card ── */}
      <FadeSlideIn delay={40} style={styles.heroCard}>
        {/* Glow overlay at top-right */}
        <View style={styles.heroGlow} />

        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroLabel}>Total balance</Text>
            <Text style={styles.heroBalance}>{money(totalEUR)}</Text>
            <View style={{ marginTop: 8 }}>
              <Delta value={deltaBalance} />
            </View>
          </View>
          <View style={styles.heroFlowCol}>
            <View style={styles.heroFlowItem}>
              <View style={[styles.heroFlowIcon, { backgroundColor: 'rgba(52,211,153,0.18)' }]}>
                <Icon name="arrowDownLeft" size={14} color={THEME.colors.pos} />
              </View>
              <View>
                <Text style={styles.heroFlowLabel}>In</Text>
                <Text style={[styles.heroFlowValue, { color: THEME.colors.pos }]}>
                  {money(currentMonthFlow.in, 'EUR', { signed: true })}
                </Text>
              </View>
            </View>
            <View style={styles.heroFlowItem}>
              <View style={[styles.heroFlowIcon, { backgroundColor: 'rgba(248,113,113,0.18)' }]}>
                <Icon name="arrowUpRight" size={14} color={THEME.colors.neg} />
              </View>
              <View>
                <Text style={styles.heroFlowLabel}>Out</Text>
                <Text style={styles.heroFlowValue}>
                  {money(currentMonthFlow.out, 'EUR')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Sparkline */}
        <View style={styles.sparkWrap}>
          <Sparkline data={balanceTrend} h={72} />
        </View>
      </FadeSlideIn>

      {/* ── Quick actions ── */}
      <FadeSlideIn delay={80} style={styles.quickRow}>
        {QUICK_ACTIONS.map(a => (
          <PressableScale
            key={a.label}
            onPress={a.route ? () => navigate(a.route) : onTopup}
            style={styles.qaction}
            innerStyle={styles.qactionInner}
            scaleTo={0.91}
            accessibilityLabel={a.label}
          >
            <View style={[styles.qactionIcon, a.primary ? styles.qactionIconPrimary : styles.qactionIconGhost]}>
              <Icon name={a.icon} size={21} color={a.primary ? THEME.colors.onAccent : THEME.colors.text} />
            </View>
            <Text style={styles.qactionLabel}>{a.label}</Text>
          </PressableScale>
        ))}
      </FadeSlideIn>

      {/* ── Accounts horizontal scroll ── */}
      <FadeSlideIn delay={120} style={styles.section}>
        <Text style={styles.sectionTitle}>Accounts</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll} snapToInterval={ACCOUNT_CARD_W + ACCOUNT_CARD_GAP} decelerationRate="fast">
          {wallets.map((wl: any) => {
            const accentCol = wl.type === 'savings' ? '#a78bfa' : wl.type === 'travel' ? '#38bdf8' : THEME.colors.accent;
            return (
              <TouchableOpacity key={wl.id} activeOpacity={0.82} onPress={() => navigate(`account:${wl.id}`)}
                style={[styles.accountCard, { borderTopColor: accentCol }]}
                accessibilityRole="button"
                accessibilityLabel={`${wl.name || 'Account'}, balance ${money(wl.balance, wl.currency)}`}
              >
                <View style={styles.accTop}>
                  <View style={styles.accNameRow}>
                    <Icon name={wl.type === 'savings' ? 'targetRing' : wl.type === 'travel' ? 'plane' : 'card'} size={14} color={accentCol} />
                    <Text style={styles.accName}>{wl.name || 'Account'}</Text>
                  </View>
                  <Text style={styles.accCurrency}>{wl.currency}</Text>
                </View>
                <Text style={[styles.accBalance, { color: accentCol }]}>{money(wl.balance, wl.currency)}</Text>
                <View style={styles.accBottom}>
                  <Text style={styles.accIban} numberOfLines={1}>{wl.iban}</Text>
                  {(wl.interestRate || 0) > 0 ? (
                    <View style={styles.apyBadge}>
                      <Text style={styles.apyText}>{((wl.interestRate || 0) * 100).toFixed(1)}% APY</Text>
                    </View>
                  ) : (
                    <Text style={styles.viewLabel}>View →</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </FadeSlideIn>

      {/* ── Recent activity ── */}
      <FadeSlideIn delay={160} style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          <TouchableOpacity onPress={() => navigate('transactions')} accessibilityRole="button" accessibilityLabel="See all transactions" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        <View>
          {recent.map((t: any, idx: number) => {
            const cat = t.type === 'deposit' ? 'deposit' : 'transfer';
            const displayAmt = t.receiverWalletId && wallets.some((w: any) => w.id === t.receiverWalletId) ? t.amount : -t.amount;
            return (
              <View key={t.id} style={[styles.txRow, idx === 0 && { borderTopWidth: 0 }]}>
                <CategoryIcon cat={cat} size={42} />
                <View style={styles.txMeta}>
                  <Text style={styles.txDesc} numberOfLines={1}>{t.description}</Text>
                  <Text style={styles.txTime}>{relTime(new Date(t.createdAt).getTime())}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.txAmt, { color: displayAmt > 0 ? THEME.colors.pos : THEME.colors.text }]}>
                    {money(displayAmt, t.currency || 'EUR', { signed: true })}
                  </Text>
                  <Text style={styles.txCur}>{t.currency || 'EUR'}</Text>
                </View>
              </View>
            );
          })}
          {recent.length === 0 && <Text style={styles.emptyText}>No recent activity yet.</Text>}
        </View>
      </FadeSlideIn>

      {/* ── Spending breakdown ── */}
      {topCats.length > 0 && (
        <FadeSlideIn delay={200} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Spending</Text>
            <TouchableOpacity onPress={() => navigate('analytics')} accessibilityRole="button" accessibilityLabel="Open analytics" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.seeAll}>Analytics</Text>
            </TouchableOpacity>
          </View>
          <View style={{ gap: 10 }}>
            {topCats.map(c => {
              const pct = totalSpend > 0 ? Math.round((c.amount / totalSpend) * 100) : 0;
              return (
                <View key={c.cat}>
                  <View style={styles.catRow}>
                    <View style={styles.catDot}>
                      <CategoryIcon cat={c.cat} size={32} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                        <Text style={styles.catName}>{c.label}</Text>
                        <Text style={styles.catAmt}>{money(c.amount, 'EUR', { whole: true })}</Text>
                      </View>
                      <AnimatedProgressBar pct={pct} color={catColor(c.hue)} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </FadeSlideIn>
      )}

      {/* ── Bank card preview ── */}
      {card && (
        <FadeSlideIn delay={240} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>My card</Text>
            <TouchableOpacity onPress={() => navigate('cards')} accessibilityRole="button" accessibilityLabel="Manage cards" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.seeAll}>Manage</Text>
            </TouchableOpacity>
          </View>
          <BankCard card={card} />
        </FadeSlideIn>
      )}

      {/* ── Savings goals ── */}
      {goalsPreview.length > 0 && (
        <FadeSlideIn delay={280} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Goals</Text>
            <TouchableOpacity onPress={() => navigate('savings')} accessibilityRole="button" accessibilityLabel="See all goals" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={{ gap: 14 }}>
            {goalsPreview.map((g: any) => {
              const pct = Math.round((g.saved / g.target) * 100);
              return (
                <View key={g.id} style={styles.goalRow}>
                  <Ring pct={pct} size={50} thickness={5} color={catColor(g.hue)}>
                    <Icon name={g.icon} size={16} color={catColor(g.hue)} />
                  </Ring>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={styles.goalName}>{g.name}</Text>
                      <Text style={[styles.goalPct, { color: catColor(g.hue) }]}>{pct}%</Text>
                    </View>
                    <AnimatedProgressBar pct={pct} color={catColor(g.hue)} style={{ marginTop: 6 }} />
                    <Text style={styles.goalSub}>{money(g.saved, 'EUR', { whole: true })} of {money(g.target, 'EUR', { whole: true })}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </FadeSlideIn>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg },
  content: { padding: 16, gap: 14, paddingBottom: 88 },

  /* greeting */
  greeting: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  greetingLabel: { fontSize: 12, color: THEME.colors.text3, fontWeight: '600', letterSpacing: 0.3 },
  greetingName: { fontSize: 30, fontWeight: 'bold', color: THEME.colors.text, marginTop: 2, letterSpacing: -0.6 },
  planBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: THEME.colors.accentSoft, borderColor: THEME.colors.accentLine, borderWidth: 1, borderRadius: 99, paddingVertical: 4, paddingHorizontal: 10 },
  planText: { color: THEME.colors.accent, fontSize: 11, fontWeight: 'bold' },

  /* hero card */
  heroCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.xl, borderWidth: 1, borderColor: THEME.colors.line, padding: 20, gap: 16, overflow: 'hidden', position: 'relative', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 8 },
  heroGlow: { position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: THEME.colors.accentSoft },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: THEME.colors.text3, letterSpacing: 1.2 },
  heroBalance: { fontSize: 36, fontWeight: 'bold', color: THEME.colors.text, letterSpacing: -1, marginTop: 4 },
  heroFlowCol: { gap: 12, alignItems: 'flex-end' },
  heroFlowItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroFlowIcon: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  heroFlowLabel: { fontSize: 10, color: THEME.colors.text3, fontWeight: '600' },
  heroFlowValue: { fontSize: 13, fontWeight: 'bold', color: THEME.colors.text, marginTop: 1 },
  sparkWrap: { marginHorizontal: -4 },

  /* quick actions */
  quickRow: { flexDirection: 'row', backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.xl, borderWidth: 1, borderColor: THEME.colors.line, padding: 8 },
  qaction: { flex: 1, paddingVertical: 10 },
  qactionInner: { alignItems: 'center', gap: 7 },
  qactionIcon: { width: 60, height: 60, borderRadius: THEME.radius.xl, justifyContent: 'center', alignItems: 'center' },
  qactionIconPrimary: { backgroundColor: THEME.colors.accent, shadowColor: THEME.colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  qactionIconGhost: { backgroundColor: THEME.colors.surface2, borderWidth: 1, borderColor: THEME.colors.line },
  qactionLabel: { fontSize: 12, fontWeight: '600', color: THEME.colors.text2, letterSpacing: 0.2 },

  /* accounts */
  section: { gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: THEME.colors.text, letterSpacing: -0.3 },
  hScroll: { gap: 12, paddingRight: 16 },
  accountCard: { width: 222, backgroundColor: THEME.colors.surface, borderWidth: 1, borderColor: THEME.colors.line, borderRadius: THEME.radius.lg, padding: 16, gap: 10, borderTopWidth: 3, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  accTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  accName: { fontSize: 13, fontWeight: '600', color: THEME.colors.text },
  accCurrency: { fontSize: 11, fontWeight: 'bold', color: THEME.colors.text3 },
  accBalance: { fontSize: 22, fontWeight: 'bold', color: THEME.colors.text, letterSpacing: -0.5 },
  accBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accIban: { fontSize: 10, color: THEME.colors.text3, flex: 1 },
  viewLabel: { fontSize: 10, color: THEME.colors.text3, fontWeight: '600' },
  apyBadge: { backgroundColor: THEME.colors.accentSoft, borderColor: THEME.colors.accentLine, borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  apyText: { fontSize: 10, color: THEME.colors.accent, fontWeight: 'bold' },

  /* card */
  card: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.line, padding: 16, gap: 14, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seeAll: { fontSize: 13, color: THEME.colors.accent, fontWeight: 'bold' },

  /* transactions */
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: THEME.colors.line },
  txMeta: { flex: 1 },
  txDesc: { fontSize: 14, fontWeight: '600', color: THEME.colors.text },
  txTime: { fontSize: 11, color: THEME.colors.text3, marginTop: 2 },
  txAmt: { fontSize: 15, fontWeight: 'bold' },
  txCur: { fontSize: 10, color: THEME.colors.text3, marginTop: 1 },
  emptyText: { color: THEME.colors.text3, fontSize: 13, textAlign: 'center', paddingVertical: 12 },

  /* spending */
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catDot: { flexShrink: 0 },
  catName: { fontSize: 13, fontWeight: '600', color: THEME.colors.text2 },
  catAmt: { fontSize: 13, fontWeight: 'bold', color: THEME.colors.text },

  /* goals */
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  goalName: { fontSize: 14, fontWeight: '600', color: THEME.colors.text },
  goalPct: { fontSize: 14, fontWeight: 'bold' },
  goalSub: { fontSize: 11, color: THEME.colors.text3, marginTop: 4 },
});
