import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Icon } from '../components/Icon';
import { money } from '../components/UI';
import { FadeSlideIn } from '../components/Motion';
import { THEME, themedSheet } from '../theme';

interface Props {
  token: string | null;
  apiUrl: string;
  wallets: { id: string; type: string; currency: string; balance: number }[];
  fire: (t: string, b: string, type?: string) => void;
  onBack: () => void;
  onRefresh: () => void;
}

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'SEK', 'NOK', 'DKK'];

export function ScreenFxExchange({ token, apiUrl, wallets, fire, onBack, onRefresh }: Props) {
  const [rates, setRates] = useState<Record<string, Record<string, number>>>({});
  const [fromCurrency, setFromCurrency] = useState('EUR');
  const [toCurrency, setToCurrency] = useState('USD');
  const [amt, setAmt] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchRates = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/api/fx/rates`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setRates(await res.json());
    } catch { /* offline */ }
  }, [token, apiUrl]);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  const fromWallet = wallets.find(w => w.currency === fromCurrency);
  const toWallet = wallets.find(w => w.currency === toCurrency);
  const rate = rates[fromCurrency]?.[toCurrency] || 0;
  const val = parseFloat(amt) || 0;
  const converted = parseFloat((val * rate).toFixed(2));

  const exchange = async () => {
    if (!fromWallet || !toWallet || val <= 0 || !rate) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/fx/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fromWalletId: fromWallet.id, toWalletId: toWallet.id, amount: val, fromCurrency, toCurrency }),
      });
      if (res.ok) {
        fire('Exchange complete', `${val} ${fromCurrency} → ${converted} ${toCurrency}`, 'success');
        setAmt('');
        onRefresh();
      } else {
        const err = await res.json();
        fire('Error', err.error || 'Exchange failed.', 'error');
      }
    } catch { fire('Error', 'Exchange failed.', 'error'); }
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 88 }}>
      <FadeSlideIn delay={0}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="arrowLeft" size={22} color={THEME.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Currency Exchange</Text>
        </View>
      </FadeSlideIn>

      <FadeSlideIn delay={60}>
        <View style={styles.card}>
          <Text style={styles.label}>From</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {CURRENCIES.filter(c => wallets.some(w => w.currency === c)).map(c => (
              <TouchableOpacity key={c} style={[styles.chip, fromCurrency === c && { backgroundColor: THEME.colors.accent }]} onPress={() => setFromCurrency(c)}>
                <Text style={[styles.chipText, fromCurrency === c && { color: THEME.colors.onAccent }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {fromWallet && <Text style={styles.balance}>Balance: {money(fromWallet.balance, fromWallet.currency)}</Text>}

          <TextInput
            style={styles.input}
            placeholder="Amount"
            placeholderTextColor={THEME.colors.text3}
            value={amt}
            onChangeText={setAmt}
            keyboardType="decimal-pad"
          />

          <View style={{ alignItems: 'center', marginVertical: 16 }}>
            <Icon name="arrowDownLeft" size={24} color={THEME.colors.accent} />
            {rate > 0 && <Text style={styles.rateText}>1 {fromCurrency} = {rate} {toCurrency}</Text>}
          </View>

          <Text style={styles.label}>To</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {CURRENCIES.filter(c => c !== fromCurrency).map(c => (
              <TouchableOpacity key={c} style={[styles.chip, toCurrency === c && { backgroundColor: THEME.colors.accent }]} onPress={() => setToCurrency(c)}>
                <Text style={[styles.chipText, toCurrency === c && { color: THEME.colors.onAccent }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {toWallet && <Text style={styles.balance}>Balance: {money(toWallet.balance, toWallet.currency)}</Text>}

          {val > 0 && rate > 0 && (
            <View style={styles.preview}>
              <Text style={styles.previewText}>You'll receive: {converted} {toCurrency}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.ctaBtn, { marginTop: 16 }, (!fromWallet || !toWallet || val <= 0 || !rate) && { opacity: 0.5 }]}
            onPress={exchange}
            disabled={loading || !fromWallet || !toWallet || val <= 0 || !rate}
          >
            <Text style={styles.ctaBtnText}>{loading ? 'Exchanging...' : 'Exchange'}</Text>
          </TouchableOpacity>
        </View>
      </FadeSlideIn>
    </ScrollView>
  );
}

const styles = themedSheet(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.bg, paddingHorizontal: 16, paddingTop: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: THEME.colors.text, flex: 1 },
  card: { backgroundColor: THEME.colors.surface, borderRadius: THEME.radius.regular, padding: 20 },
  label: { color: THEME.colors.text2, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  balance: { color: THEME.colors.text3, fontSize: 12, marginBottom: 12 },
  input: { backgroundColor: THEME.colors.bg, color: THEME.colors.text, borderRadius: THEME.radius.regular, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, fontWeight: '600', textAlign: 'center' },
  chip: { backgroundColor: THEME.colors.bg, paddingVertical: 8, paddingHorizontal: 14, borderRadius: THEME.radius.regular },
  chipText: { color: THEME.colors.text2, fontSize: 14, fontWeight: '600' },
  rateText: { color: THEME.colors.text2, fontSize: 13, marginTop: 4 },
  preview: { backgroundColor: THEME.colors.bg, borderRadius: THEME.radius.regular, padding: 12, alignItems: 'center', marginTop: 8 },
  previewText: { color: THEME.colors.accent, fontWeight: '700', fontSize: 16 },
  ctaBtn: { backgroundColor: THEME.colors.accent, paddingVertical: 14, borderRadius: THEME.radius.regular, alignItems: 'center' },
  ctaBtnText: { color: THEME.colors.onAccent, fontWeight: '600', fontSize: 16 },
}));
