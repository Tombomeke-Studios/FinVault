import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Icon } from '../components/Icon';
import { money, Sparkline, relTime, CategoryIcon, Ring, Donut, catColor, Delta, Avatar } from '../components/UI';
import { BankCard } from '../components/BankCard';
import { THEME } from '../theme';
import type { AppData } from '../../App';

interface OverviewProps {
  navigate: (r: string) => void;
  data: AppData;
  onTopup: () => void;
}

export function ScreenOverview({ navigate, data, onTopup }: OverviewProps) {
  const [selWallet, setSelWallet] = useState(0);
  const { wallets, transactions, cards, goals, spendByCat, balanceTrend } = data;

  const totalEUR = wallets.filter((w: any) => w.currency === 'EUR').reduce((s: number, w: any) => s + w.balance, 0);
  const recent = transactions.slice(0, 5);
  const card = cards[0];
  const goalsPreview = goals.slice(0, 2);
  const topCats = [...spendByCat].sort((a, b) => b.amount - a.amount).slice(0, 4);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Greeting row */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          <Text style={styles.title}>Hi {data.user.firstName} 👋</Text>
        </View>
        <View style={styles.planBadge}>
          <Icon name="sparkle" size={11} color={THEME.colors.accent} />
          <Text style={styles.planText}>Metal</Text>
        </View>
      </View>

      {/* Hero balance card */}
      <View style={[styles.card, styles.heroCard]}>
        <View style={styles.balanceHeader}>
          <View>
            <Text style={styles.heroEyebrow}>Total balance · EUR</Text>
            <Text style={styles.balanceText}>{money(totalEUR)}</Text>
          </View>
          <Delta value={6.4} />
        </View>

        {/* Sparkline chart */}
        <View style={styles.chartWrapper}>
          <Sparkline data={balanceTrend} h={70} />
        </View>

        {/* Flow details row */}
        <View style={styles.flowRow}>
          <View style={styles.flowCol}>
            <View style={[styles.flowCircle, { backgroundColor: 'rgba(52, 211, 153, 0.16)' }]}>
              <Icon name="arrowDownLeft" size={13} color={THEME.colors.pos} />
            </View>
            <View>
              <Text style={styles.flowLabel}>Money in</Text>
              <Text style={styles.flowValue}>{money(3234.95, 'EUR', { signed: true })}</Text>
            </View>
          </View>

          <View style={styles.flowCol}>
            <View style={[styles.flowCircle, { backgroundColor: 'rgba(248, 113, 113, 0.16)' }]}>
              <Icon name="arrowUpRight" size={13} color={THEME.colors.neg} />
            </View>
            <View>
              <Text style={styles.flowLabel}>Money out</Text>
              <Text style={styles.flowValue}>{money(-1879.40, 'EUR', { signed: true })}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Quick Action buttons */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={() => navigate('transfer')}>
          <Icon name="send" size={20} color={THEME.colors.onAccent} />
          <Text style={[styles.actionText, styles.actionTextPrimary]}>Send</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigate('transfer')}>
          <Icon name="qr" size={20} color={THEME.colors.text} />
          <Text style={styles.actionText}>Request</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onTopup}>
          <Icon name="plus" size={20} color={THEME.colors.text} />
          <Text style={styles.actionText}>Top up</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => navigate('transfer')}>
          <Icon name="bolt" size={20} color={THEME.colors.text} />
          <Text style={styles.actionText}>Pay bill</Text>
        </TouchableOpacity>
      </View>

      {/* Accounts slider */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your accounts</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizScroll} snapToInterval={246} decelerationRate="fast">
          {wallets.map((wl: any, i: number) => (
            <TouchableOpacity key={wl.id} activeOpacity={0.8} onPress={() => setSelWallet(i)} style={[
              styles.accountCard,
              { borderColor: i === selWallet ? THEME.colors.accentLine : THEME.colors.line }
            ]}>
              <View style={styles.accHeader}>
                <View style={styles.accIconName}>
                  <Icon name={wl.type === 'savings' ? 'targetRing' : 'card'} size={15} color={THEME.colors.accent} />
                  <Text style={styles.accName}>{wl.name || 'Account'}</Text>
                </View>
                <Text style={styles.accCurrency}>{wl.currency}</Text>
              </View>
              <Text style={styles.accBalance}>{money(wl.balance, wl.currency)}</Text>
              <View style={styles.accFooter}>
                <Text style={styles.accIban}>{wl.iban}</Text>
                {(wl.interestRate || 0) > 0 && (
                  <View style={styles.apyBadge}>
                    <Text style={styles.apyText}>{((wl.interestRate || 0) * 100).toFixed(1)}% APY</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Recent transactions */}
      <View style={[styles.card, styles.sectionCard]}>
        <View style={styles.sectionHeaderInside}>
          <Text style={styles.sectionTitle}>Recent activity</Text>
          <TouchableOpacity onPress={() => navigate('transactions')}>
            <Text style={styles.seeAllBtn}>See all</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.list}>
          {recent.map((t: any) => {
            const cat = t.type === 'deposit' ? 'deposit' : 'transfer';
            const displayAmt = t.receiverWalletId && wallets.some((w: any) => w.id === t.receiverWalletId) ? t.amount : -t.amount;
            return (
              <View key={t.id} style={styles.txRow}>
                <CategoryIcon cat={cat} size={38} />
                <View style={styles.txMeta}>
                  <Text style={styles.txDesc} numberOfLines={1}>{t.description}</Text>
                  <Text style={styles.txTime}>{relTime(new Date(t.createdAt).getTime())}</Text>
                </View>
                <Text style={[styles.txAmt, { color: displayAmt > 0 ? THEME.colors.pos : THEME.colors.text }]}>
                  {money(displayAmt, t.currency || 'EUR', { signed: true })}
                </Text>
              </View>
            );
          })}
          {recent.length === 0 && <Text style={styles.emptyText}>No recent activity yet.</Text>}
        </View>
      </View>

      {/* Savings goals */}
      {goalsPreview.length > 0 && (
        <View style={[styles.card, styles.sectionCard]}>
          <View style={styles.sectionHeaderInside}>
            <Text style={styles.sectionTitle}>Savings goals</Text>
            <TouchableOpacity onPress={() => navigate('savings')}>
              <Text style={styles.seeAllBtn}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.goalsList}>
            {goalsPreview.map((g: any) => {
              const pct = Math.round((g.saved / g.target) * 100);
              return (
                <View key={g.id} style={styles.goalRow}>
                  <Ring pct={pct} size={48} thickness={5} color={catColor(g.hue)}>
                    <Icon name={g.icon} size={15} color={catColor(g.hue)} />
                  </Ring>
                  <View style={styles.goalMeta}>
                    <View style={styles.goalTitleRow}>
                      <Text style={styles.goalName}>{g.name}</Text>
                      <Text style={styles.goalPct}>{pct}%</Text>
                    </View>
                    <Text style={styles.goalDetails}>
                      {money(g.saved).replace('.00', '')} of {money(g.target).replace('.00', '')}
                    </Text>
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
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: THEME.colors.text3,
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: THEME.colors.text,
    fontFamily: THEME.fonts.display,
    marginTop: 4,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.accentSoft,
    borderColor: THEME.colors.accentLine,
    borderWidth: 1,
    borderRadius: THEME.radius.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  planText: {
    color: THEME.colors.accent,
    fontSize: 11,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  heroCard: {
    padding: 20,
    gap: 14,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroEyebrow: {
    fontSize: 10.5,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: THEME.colors.text3,
    letterSpacing: 1.2,
  },
  balanceText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: THEME.colors.text,
    fontFamily: THEME.fonts.display,
    marginTop: 4,
  },
  chartWrapper: {
    marginVertical: 4,
  },
  flowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: THEME.colors.line,
    paddingTop: 14,
  },
  flowCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flowLabel: {
    fontSize: 11,
    color: THEME.colors.text3,
  },
  flowValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: THEME.colors.text,
    marginTop: 2,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.regular,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionPrimary: {
    backgroundColor: THEME.colors.accent,
    borderColor: 'transparent',
  },
  actionText: {
    color: THEME.colors.text,
    fontSize: 11,
    fontWeight: 'bold',
  },
  actionTextPrimary: {
    color: THEME.colors.onAccent,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderInside: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: THEME.colors.text,
  },
  seeAllBtn: {
    fontSize: 13,
    color: THEME.colors.accent,
    fontWeight: 'bold',
  },
  horizScroll: {
    gap: 12,
    paddingRight: 16,
  },
  accountCard: {
    width: 230,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderRadius: THEME.radius.lg,
    padding: 16,
    gap: 12,
  },
  accHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accIconName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  accName: {
    color: THEME.colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  accCurrency: {
    color: THEME.colors.text3,
    fontSize: 11,
    fontWeight: 'bold',
  },
  accBalance: {
    fontSize: 20,
    fontWeight: 'bold',
    color: THEME.colors.text,
    fontFamily: THEME.fonts.display,
  },
  accFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accIban: {
    fontSize: 11,
    color: THEME.colors.text3,
  },
  apyBadge: {
    backgroundColor: THEME.colors.surface2,
    borderColor: THEME.colors.line,
    borderWidth: 1,
    borderRadius: THEME.radius.pill,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  apyText: {
    fontSize: 10,
    color: THEME.colors.accent,
    fontWeight: 'bold',
  },
  sectionCard: {
    padding: 16,
  },
  list: {
    gap: 12,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.line,
    paddingTop: 10,
  },
  txMeta: {
    flex: 1,
  },
  txDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  txTime: {
    fontSize: 12,
    color: THEME.colors.text3,
    marginTop: 2,
  },
  txAmt: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  emptyText: {
    color: THEME.colors.text3,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
  goalsList: {
    gap: 12,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  goalMeta: {
    flex: 1,
  },
  goalTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalName: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  goalPct: {
    fontSize: 13,
    fontWeight: 'bold',
    color: THEME.colors.text,
  },
  goalDetails: {
    fontSize: 12,
    color: THEME.colors.text3,
    marginTop: 2,
  },
});
