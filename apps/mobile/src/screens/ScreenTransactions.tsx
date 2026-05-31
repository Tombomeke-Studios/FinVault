import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { Icon } from '../components/Icon';
import { money, CategoryIcon, relTime } from '../components/UI';
import { THEME } from '../theme';
import type { AppData } from '../../App';

interface TransactionsProps {
  data: AppData;
  onExport: () => void;
}

export function ScreenTransactions({ data, onExport }: TransactionsProps) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');

  const getDisplayAmt = (t: any) => {
    const isIncoming = t.receiverWalletId && data.wallets.some(w => w.id === t.receiverWalletId);
    return isIncoming ? t.amount : -t.amount;
  };

  const filtered = useMemo(() => {
    return data.transactions.filter(t => {
      const displayCat = t.type === 'deposit' ? 'deposit' : 'transfer';
      const matchesCat = cat === 'all' || displayCat === cat;
      const matchesSearch = q === '' || t.description.toLowerCase().includes(q.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [q, cat, data.transactions]);

  const monthIn = useMemo(() => filtered.filter(t => getDisplayAmt(t) > 0).reduce((s, t) => s + getDisplayAmt(t), 0), [filtered]);
  const monthOut = useMemo(() => filtered.filter(t => getDisplayAmt(t) < 0).reduce((s, t) => s + getDisplayAmt(t), 0), [filtered]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Activity</Text>
          <Text style={styles.subtitle}>Your ledger transactions.</Text>
        </View>
        <TouchableOpacity style={styles.exportBtn} onPress={onExport}>
          <Icon name="download" size={16} color={THEME.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Summary grid */}
      <View style={styles.summaryGrid}>
        <View style={[styles.card, styles.summaryCard]}>
          <Text style={styles.sumLabel}>Money in</Text>
          <Text style={[styles.sumVal, { color: THEME.colors.pos }]}>{money(monthIn)}</Text>
        </View>
        <View style={[styles.card, styles.summaryCard]}>
          <Text style={styles.sumLabel}>Money out</Text>
          <Text style={[styles.sumVal, { color: THEME.colors.neg }]}>{money(Math.abs(monthOut))}</Text>
        </View>
      </View>

      {/* Search & Filter row */}
      <View style={styles.searchRow}>
        <View style={styles.searchWrapper}>
          <Icon name="search" size={16} color={THEME.colors.text3} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={q}
            onChangeText={setQ}
            placeholder="Search transactions…"
            placeholderTextColor={THEME.colors.text3}
          />
        </View>
      </View>

      {/* Categories slider */}
      <View style={styles.categories}>
        {['all', 'deposit', 'transfer'].map(c => (
          <TouchableOpacity key={c} onPress={() => setCat(c)} style={[
            styles.catBtn,
            cat === c ? styles.catBtnActive : null
          ]}>
            <Text style={[
              styles.catText,
              cat === c ? styles.catTextActive : null
            ]}>
              {c.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transactions list */}
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.map(t => {
          const displayCat = t.type === 'deposit' ? 'deposit' : 'transfer';
          const amt = getDisplayAmt(t);
          return (
            <View key={t.id} style={[styles.card, styles.txCard]}>
              <CategoryIcon cat={displayCat} size={36} />
              <View style={styles.txMeta}>
                <Text style={styles.txDesc} numberOfLines={1}>{t.description}</Text>
                <Text style={styles.txTime}>{relTime(new Date(t.createdAt).getTime())}</Text>
              </View>
              <Text style={[styles.txAmt, { color: amt > 0 ? THEME.colors.pos : THEME.colors.text }]}>
                {money(amt, t.currency || 'EUR', { signed: true })}
              </Text>
            </View>
          );
        })}
        {filtered.length === 0 && <Text style={styles.emptyText}>No matching transactions found.</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: THEME.colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.text3,
    marginTop: 2,
  },
  exportBtn: {
    width: 38,
    height: 38,
    borderRadius: THEME.radius.pill,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.regular,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  summaryCard: {
    flex: 1,
    padding: 14,
  },
  sumLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: THEME.colors.text3,
    letterSpacing: 1,
  },
  sumVal: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 6,
  },
  searchRow: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },
  searchInput: {
    backgroundColor: THEME.colors.surface,
    borderColor: THEME.colors.line,
    borderWidth: 1,
    borderRadius: THEME.radius.regular,
    paddingVertical: 10,
    paddingLeft: 42,
    paddingRight: 16,
    color: THEME.colors.text,
    fontSize: 14,
  },
  categories: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  catBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: THEME.radius.pill,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  catBtnActive: {
    backgroundColor: THEME.colors.accentSoft,
    borderColor: THEME.colors.accentLine,
  },
  catText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: THEME.colors.text3,
  },
  catTextActive: {
    color: THEME.colors.accent,
  },
  list: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 32,
  },
  txCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
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
    paddingVertical: 24,
  },
});
