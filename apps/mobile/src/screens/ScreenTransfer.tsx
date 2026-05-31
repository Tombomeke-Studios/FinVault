import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Icon } from '../components/Icon';
import { money } from '../components/UI';
import { THEME } from '../theme';
import type { AppData } from '../../App';

interface TransferProps {
  data: AppData;
  onTransfer: (email: string, amt: number, desc: string, walletId: string) => Promise<void>;
  onRequest: (email: string, amt: number, desc: string) => Promise<void>;
}

export function ScreenTransfer({ data, onTransfer, onRequest }: TransferProps) {
  const [mode, setMode] = useState<'send' | 'request'>('send');
  const [email, setEmail] = useState('');
  const [amt, setAmt] = useState('');
  const [desc, setDesc] = useState('');
  const [selWallet, setSelWallet] = useState(data.wallets[0]?.id || '');
  const [loading, setLoading] = useState(false);

  const activeWallet = data.wallets.find(w => w.id === selWallet) || data.wallets[0];

  const submit = async () => {
    const val = parseFloat(amt);
    if (!email) { Alert.alert('Error', 'Please enter a recipient email.'); return; }
    if (!val || val <= 0) { Alert.alert('Error', 'Please enter a valid amount.'); return; }

    setLoading(true);
    try {
      if (mode === 'send') {
        if (activeWallet && activeWallet.balance < val) {
          Alert.alert('Insufficient Balance', 'Your wallet balance is too low.');
          return;
        }
        await onTransfer(email, val, desc || 'Transfer', selWallet);
      } else {
        await onRequest(email, val, desc || 'Request');
      }
      setEmail('');
      setAmt('');
      setDesc('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Money</Text>
        <Text style={styles.subtitle}>Instant transfers & requests.</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, mode === 'send' ? styles.tabActive : null]} onPress={() => setMode('send')}>
          <Text style={[styles.tabText, mode === 'send' ? styles.tabTextActive : null]}>SEND MONEY</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, mode === 'request' ? styles.tabActive : null]} onPress={() => setMode('request')}>
          <Text style={[styles.tabText, mode === 'request' ? styles.tabTextActive : null]}>REQUEST MONEY</Text>
        </TouchableOpacity>
      </View>

      {/* Main card */}
      <View style={[styles.card, styles.formCard]}>
        {/* Source wallet (Send only) */}
        {mode === 'send' && (
          <View>
            <Text style={styles.label}>Source wallet</Text>
            <View style={styles.walletPicker}>
              {data.wallets.map(w => (
                <TouchableOpacity key={w.id} onPress={() => setSelWallet(w.id)} style={[
                  styles.walletOption,
                  selWallet === w.id ? styles.walletOptionActive : null
                ]}>
                  <Text style={[styles.walletName, selWallet === w.id ? styles.walletNameActive : null]}>{w.name}</Text>
                  <Text style={styles.walletBal}>{money(w.balance, w.currency)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Recipient Email */}
        <View>
          <Text style={styles.label}>{mode === 'send' ? 'Recipient email' : 'Payer email'}</Text>
          <View style={styles.inputWrapper}>
            <Icon name="search" size={16} color={THEME.colors.text3} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { paddingLeft: 42 }]}
              value={email}
              onChangeText={setEmail}
              placeholder="name@email.com"
              placeholderTextColor={THEME.colors.text3}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Amount */}
        <View>
          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.amountInput}
            value={amt}
            onChangeText={v => setAmt(v.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            placeholderTextColor={THEME.colors.text3}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Reference/Description */}
        <View>
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={styles.input}
            value={desc}
            onChangeText={setDesc}
            placeholder="Rent split, dinner, etc."
            placeholderTextColor={THEME.colors.text3}
          />
        </View>

        {/* Submit button */}
        <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={loading}>
          <Icon name="send" size={16} color={THEME.colors.onAccent} />
          <Text style={styles.submitText}>
            {loading ? 'Processing…' : mode === 'send' ? `Send ${amt ? money(parseFloat(amt)) : 'Funds'}` : 'Send Request'}
          </Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: 32,
  },
  header: {
    paddingBottom: 4,
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surface,
    borderColor: THEME.colors.line,
    borderWidth: 1,
    borderRadius: THEME.radius.regular,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: THEME.radius.sm,
  },
  tabActive: {
    backgroundColor: THEME.colors.surface2,
    borderColor: THEME.colors.line,
    borderWidth: 0.5,
  },
  tabText: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: THEME.colors.text3,
    letterSpacing: 1.2,
  },
  tabTextActive: {
    color: THEME.colors.accent,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  formCard: {
    padding: 20,
    gap: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.text2,
    marginBottom: 8,
  },
  walletPicker: {
    flexDirection: 'row',
    gap: 10,
  },
  walletOption: {
    flex: 1,
    backgroundColor: THEME.colors.surface2,
    borderRadius: THEME.radius.regular,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    gap: 4,
  },
  walletOptionActive: {
    borderColor: THEME.colors.accentLine,
    backgroundColor: THEME.colors.accentSoft,
  },
  walletName: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text2,
  },
  walletNameActive: {
    color: THEME.colors.accent,
  },
  walletBal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: THEME.colors.text,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },
  input: {
    backgroundColor: THEME.colors.surface2,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.regular,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: THEME.colors.text,
    fontSize: 15,
  },
  amountInput: {
    backgroundColor: THEME.colors.surface2,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.regular,
    paddingVertical: 14,
    color: THEME.colors.text,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  submitBtn: {
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.radius.regular,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  submitText: {
    color: THEME.colors.onAccent,
    fontSize: 15,
    fontWeight: 'bold',
  },
});
