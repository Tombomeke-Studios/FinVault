import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Icon } from '../components/Icon';
import { money } from '../components/UI';
import { classifyRecipient, isEmail, normalizeIban } from '../lib/validate';
import { THEME, themedSheet } from '../theme';
import type { AppData } from '../../App';

interface TransferProps {
  data: AppData;
  onTransfer: (target: { email?: string; iban?: string }, amt: number, desc: string, walletId: string) => Promise<boolean>;
  onRequest: (email: string, amt: number, desc: string) => Promise<void>;
}

export function ScreenTransfer({ data, onTransfer, onRequest }: TransferProps) {
  const [mode, setMode] = useState<'send' | 'request'>('send');
  const [recipient, setRecipient] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [amt, setAmt] = useState('');
  const [desc, setDesc] = useState('');
  const [selWallet, setSelWallet] = useState(data.wallets[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const activeWallet = data.wallets.find(w => w.id === selWallet) || data.wallets[0];

  // Inline validation instead of blocking Alerts (#9) — Alerts stay reserved
  // for destructive confirmations.
  const submit = async () => {
    setFormError('');
    const val = parseFloat(amt);
    const kind = classifyRecipient(recipient);

    if (mode === 'request' && !isEmail(recipient)) {
      setFormError('Enter a valid payer email address.');
      return;
    }
    if (mode === 'send' && kind === 'invalid') {
      setFormError('Enter a valid email address or IBAN.');
      return;
    }
    if (!val || val <= 0) { setFormError('Enter an amount greater than zero.'); return; }

    setLoading(true);
    try {
      if (mode === 'send') {
        if (activeWallet && activeWallet.balance < val) {
          setFormError(`Insufficient balance — ${money(activeWallet.balance, activeWallet.currency)} available.`);
          return;
        }
        const target = kind === 'iban'
          ? { iban: normalizeIban(recipient) }
          : { email: recipient.trim().toLowerCase() };
        // Custom recipient name flows into the description (#10).
        const description = desc || (recipientName.trim() ? `To ${recipientName.trim()}` : 'Transfer');
        const ok = await onTransfer(target, val, description, selWallet);
        if (!ok) return; // keep the form so the user can correct and retry (#11)
      } else {
        await onRequest(recipient, val, desc || 'Request');
      }
      setRecipient('');
      setRecipientName('');
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
        <TouchableOpacity
          style={[styles.tab, mode === 'send' ? styles.tabActive : null]}
          onPress={() => setMode('send')}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'send' }}
        >
          <Text style={[styles.tabText, mode === 'send' ? styles.tabTextActive : null]}>SEND MONEY</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mode === 'request' ? styles.tabActive : null]}
          onPress={() => setMode('request')}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === 'request' }}
        >
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

        {/* Recipient */}
        <View>
          <Text style={styles.label}>{mode === 'send' ? 'Recipient email or IBAN' : 'Payer email'}</Text>
          <View style={styles.inputWrapper}>
            <Icon name="user" size={16} color={THEME.colors.text3} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { paddingLeft: 42 }]}
              value={recipient}
              onChangeText={v => { setRecipient(v); if (formError) setFormError(''); }}
              placeholder={mode === 'send' ? 'name@email.com or BE89 …' : 'name@email.com'}
              placeholderTextColor={THEME.colors.text3}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />
          </View>
        </View>

        {/* Custom recipient name → description (#10) */}
        {mode === 'send' && (
          <View>
            <Text style={styles.label}>Recipient name (optional)</Text>
            <TextInput
              style={styles.input}
              value={recipientName}
              onChangeText={setRecipientName}
              placeholder="Shown in the transaction description"
              placeholderTextColor={THEME.colors.text3}
            />
          </View>
        )}

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

        {/* Inline form error (#9/#11) */}
        {formError !== '' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLiveRegion="polite">
            <Icon name="alertTriangle" size={14} color={THEME.colors.neg} />
            <Text style={{ color: THEME.colors.neg, fontSize: 13, flex: 1 }}>{formError}</Text>
          </View>
        )}

        {/* Submit button */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && { opacity: 0.7 }]}
          onPress={submit}
          disabled={loading}
          accessibilityRole="button"
          accessibilityState={{ disabled: loading, busy: loading }}
        >
          <Icon name="send" size={16} color={THEME.colors.onAccent} />
          <Text style={styles.submitText}>
            {loading ? 'Processing…' : mode === 'send' ? `Send ${amt ? money(parseFloat(amt)) : 'Funds'}` : 'Send Request'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = themedSheet(() => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bg,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 88,
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
}));
