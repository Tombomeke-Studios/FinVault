import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { Icon } from '../components/Icon';
import { money, Sparkline, relTime, CategoryIcon, Ring, catColor, Delta } from '../components/UI';
import { BankCard } from '../components/BankCard';
import { THEME } from '../theme';
import type { AppData } from '../../App';

const { width: SCREEN_W } = Dimensions.get('window');

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

function SpringBtn({ onPress, style, iconStyle, children }: { onPress: () => void; style?: any; iconStyle?: any; children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.91, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 50, bounciness: 6 }).start();
  return (
    <Pressable onPress={onPress} onPressIn={onIn} onPressOut={onOut} style={style}>
      <Animated.View style={[iconStyle, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

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

  const heroEntrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(heroEntrance, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }).start();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ── Greeting ── */}
      <View style={styles.greeting}>
        <View>
          <Text style={styles.greetingLabel}>{greeting}</Text>
          <Text style={styles.greetingName}>{data.user.firstName}</Text>
        </View>
        <View style={styles.planBadge}>
          <Icon name="sparkle" size={11} color={THEME.colors.accent} />
          <Text style={styles.planText}>{data.user.plan.replace('FinVault ', '')}</Text>
        </View>
      </View>

      {/* ── Hero balance card ── */}
      <Animated.View style={[styles.heroCard, { opacity: heroEntrance, transform: [{ translateY: heroEntrance.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
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
      </Animated.View>

      {/* ── Quick actions ── */}
      <View style={styles.quickRow}>
        {QUICK_ACTIONS.map(a => (
          <SpringBtn
            key={a.label}
            onPress={a.route ? () => navigate(a.route) : onTopup}
            style={styles.qaction}
          >
            <View style={[styles.qactionIcon, a.primary ? styles.qactionIconPrimary : styles.qactionIconGhost]}>
              <Icon name={a.icon} size={21} color={a.primary ? THEME.colors.onAccent : THEME.colors.text} />
            </View>
            <Text style={styles.qactionLabel}>{a.label}</Text>
          </SpringBtn>
        ))}
      </View>

      {/* ── Accounts horizontal scroll ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Accounts</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll} snapToInterval={238} decelerationRate="fast">
          {wallets.map((wl: any) => {
            const accentCol = wl.type === 'savings' ? '#a78bfa' : wl.type === 'travel' ? '#38bdf8' : THEME.colors.accent;
            return (
              <TouchableOpacity key={wl.id} activeOpacity={0.82} onPress={() => navigate(`account:${wl.id}`)}
                style={[styles.accountCard, { borderTopColor: accentCol }]}
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
      </View>

      {/* ── Recent activity ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          <TouchableOpacity onPress={() => navigate('transactions')}>
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
      </View>

      {/* ── Spending breakdown ── */}
      {topCats.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Spending</Text>
            <TouchableOpacity onPress={() => navigate('analytics')}>
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
                        <Text style={styles.catAmt}>{money(c.amount).replace('.00', '')}</Text>
                      </View>
                      <View style={styles.progressBg}>
                        <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: catColor(c.hue) }]} />
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Bank card preview ── */}
      {card && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>My card</Text>
            <TouchableOpacity onPress={() => navigate('cards')}>
              <Text style={styles.seeAll}>Manage</Text>
            </TouchableOpacity>
          </View>
          <BankCard card={card} />
        </View>
      )}

      {/* ── Savings goals ── */}
      {goalsPreview.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Goals</Text>
            <TouchableOpacity onPress={() => navigate('savings')}>
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
                    <View style={[styles.progressBg, { marginTop: 6 }]}>
                      <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: catColor(g.hue) }]} />
                    </View>
                    <Text style={styles.goalSub}>{money(g.saved).replace('.00', '')} of {money(g.target).replace('.00', '')}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
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
  greetingName: { fontSize: 26, fontWeight: 'bold', color: THEME.colors.text, marginTop: 2, letterSpacing: -0.5 },
  planBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: THEME.colors.accentSoft, borderColor: THEME.colors.accentLine, borderWidth: 1, borderRadius: 99, paddingVertical: 4, paddingHorizontal: 10 },
  planText: { color: THEME.colors.accent, fontSize: 11, fontWeight: 'bold' },

  /* hero card */
  heroCard: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.xl, borderWidth: 1, borderColor: THEME.colors.line, padding: 20, gap: 16, overflow: 'hidden', position: 'relative' },
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
  qaction: { flex: 1, alignItems: 'center', gap: 7, paddingVertical: 10 },
  qactionIcon: { width: 52, height: 52, borderRadius: THEME.radius.xl, justifyContent: 'center', alignItems: 'center' },
  qactionIconPrimary: { backgroundColor: THEME.colors.accent, shadowColor: THEME.colors.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  qactionIconGhost: { backgroundColor: THEME.colors.surface2, borderWidth: 1, borderColor: THEME.colors.line },
  qactionLabel: { fontSize: 11, fontWeight: '600', color: THEME.colors.text2 },

  /* accounts */
  section: { gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold', color: THEME.colors.text },
  hScroll: { gap: 12, paddingRight: 16 },
  accountCard: { width: 222, backgroundColor: THEME.colors.surface, borderWidth: 1, borderColor: THEME.colors.line, borderRadius: THEME.radius.lg, padding: 16, gap: 10, borderTopWidth: 3 },
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
  card: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.lg, borderWidth: 1, borderColor: THEME.colors.line, padding: 16, gap: 14 },
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
  progressBg: { height: 5, borderRadius: 99, backgroundColor: THEME.colors.surfaceHi, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99 },

  /* goals */
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  goalName: { fontSize: 14, fontWeight: '600', color: THEME.colors.text },
  goalPct: { fontSize: 14, fontWeight: 'bold' },
  goalSub: { fontSize: 11, color: THEME.colors.text3, marginTop: 4 },
});
