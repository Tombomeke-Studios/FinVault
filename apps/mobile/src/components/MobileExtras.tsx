import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Switch, Dimensions, TextInput } from 'react-native';
import { Icon } from './Icon';
import { BankCard } from './BankCard';
import { money } from './UI';
import { THEME } from '../theme';

// ── Drag-to-dismiss bottom sheet simulator using Modal ─────────────────────────
export function MobileSheet({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheetContainer} onStartShouldSetResponder={() => true}>
          {/* Drag handle visual */}
          <View style={styles.dragHandleWrapper}>
            <View style={styles.dragHandle} />
          </View>

          {/* Title Row */}
          {!!title && (
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Icon name="x" size={18} color={THEME.colors.text3} />
              </TouchableOpacity>
            </View>
          )}

          {/* Content */}
          <View style={styles.sheetContent}>
            {children}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── 3D Card flip simulator + detail rows ────────────────────────────────────────────
export function MobileCardDetail({ card, open, onClose, wallets, fire }: {
  card: any;
  open: boolean;
  onClose: () => void;
  wallets: any[];
  fire: (t: string, b: string, type?: string) => void;
}) {
  const [revealed, setReveal] = useState(false);
  const wallet = wallets.find(w => w.id === card.walletId) || {};

  const copy = (text: string, label: string) => {
    fire('Copied', label + ' copied to clipboard.', 'success');
  };

  const rows = [
    { label: 'Card number', value: revealed ? card.number : '•••• •••• •••• ' + card.last4, copy: card.number },
    { label: 'Expiry', value: card.exp },
    { label: 'CVV', value: revealed ? card.cvv : '•••', copy: card.cvv },
    { label: 'Linked IBAN', value: wallet.iban || '', copy: wallet.iban || '' },
    { label: 'Card holder', value: card.holder },
    { label: 'Network', value: card.network },
  ];

  return (
    <MobileSheet open={open} onClose={onClose} title="Card details">
      <View style={styles.cardDetailsForm}>
        {/* Visual card */}
        <View style={styles.centerCard}>
          <BankCard card={card} revealed={revealed} />
        </View>

        {/* Reveal Toggle */}
        <TouchableOpacity style={styles.btnGhost} onPress={() => setReveal(!revealed)}>
          <Icon name={revealed ? 'eyeOff' : 'eye'} size={16} color={THEME.colors.text} />
          <Text style={styles.btnGhostText}>
            {revealed ? 'Hide sensitive details' : 'Tap to reveal details'}
          </Text>
        </TouchableOpacity>

        {/* Info Rows */}
        <View style={styles.infoRows}>
          {rows.map((r, i) => (
            <View key={r.label} style={[
              styles.infoRow,
              { backgroundColor: i % 2 === 0 ? THEME.colors.surface2 : 'transparent' }
            ]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>{r.label}</Text>
                <Text style={styles.infoValue}>{r.value}</Text>
              </View>
              {!!r.copy && revealed && (
                <TouchableOpacity onPress={() => copy(r.copy, r.label)} style={styles.copyBtn}>
                  <Icon name="copy" size={16} color={THEME.colors.accent} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        <View style={styles.noticeRow}>
          <Icon name="lock" size={13} color={THEME.colors.text3} />
          <Text style={styles.noticeText}>
            Never share these details. FinVault will never ask for your CVV.
          </Text>
        </View>
      </View>
    </MobileSheet>
  );
}

// ── Card Limits sheet ──────────────────────────────────────────────────────────
export function LimitsSheet({ card, open, onClose, fire, onSaveLimits }: {
  card: any;
  open: boolean;
  onClose: () => void;
  fire: (t: string, b: string, type?: string) => void;
  onSaveLimits: (limit: number) => void;
}) {
  const [contactless, setContactless] = useState(true);
  const [foreign, setForeign] = useState(true);
  const [limitVal, setLimitVal] = useState(card?.limit || 2000);

  useEffect(() => {
    if (card) {
      setLimitVal(card.limit);
    }
  }, [card]);

  return (
    <MobileSheet open={open} onClose={onClose} title="Card controls">
      <View style={styles.limitsForm}>
        {/* Custom spending limit input & chips */}
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Monthly Spending Limit (€)</Text>
          <TextInput
            style={styles.amountInput}
            value={String(limitVal)}
            onChangeText={v => setLimitVal(parseInt(v.replace(/[^0-9]/g, '')) || 0)}
            keyboardType="numeric"
            placeholder="2000"
            placeholderTextColor={THEME.colors.text3}
          />
          <View style={styles.quickChips}>
            {[500, 1000, 2000, 5000].map(v => (
              <TouchableOpacity key={v} style={styles.chip} onPress={() => setLimitVal(v)}>
                <Text style={styles.chipText}>€{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Toggle rows */}
        <View style={styles.controlsList}>
          <View style={styles.controlToggleRow}>
            <View style={styles.iconDesc}>
              <View style={[styles.controlCircle, { backgroundColor: 'rgba(52, 211, 153, 0.16)' }]}>
                <Icon name="send" size={16} color={THEME.colors.accent} />
              </View>
              <Text style={styles.controlText}>Contactless payments</Text>
            </View>
            <Switch
              value={contactless}
              onValueChange={setContactless}
              trackColor={{ false: THEME.colors.surface2, true: THEME.colors.accent }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.controlToggleRow}>
            <View style={styles.iconDesc}>
              <View style={[styles.controlCircle, { backgroundColor: 'rgba(6, 182, 212, 0.16)' }]}>
                <Icon name="plane" size={16} color="#06b6d4" />
              </View>
              <Text style={styles.controlText}>Foreign transactions</Text>
            </View>
            <Switch
              value={foreign}
              onValueChange={setForeign}
              trackColor={{ false: THEME.colors.surface2, true: THEME.colors.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.btnPrimary} onPress={() => { onSaveLimits(limitVal); onClose(); fire('Settings saved', 'Your card controls have been updated.', 'success'); }}>
          <Text style={styles.btnPrimaryText}>Save controls</Text>
        </TouchableOpacity>
      </View>
    </MobileSheet>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: THEME.radius.xl,
    borderTopRightRadius: THEME.radius.xl,
    maxHeight: '90%',
    paddingBottom: 34, // Safe-area-like padding
  },
  dragHandleWrapper: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 38,
    height: 5,
    borderRadius: 99,
    backgroundColor: THEME.colors.surface2,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  sheetContent: {
    paddingHorizontal: 20,
  },
  cardDetailsForm: {
    gap: 16,
  },
  centerCard: {
    alignItems: 'center',
  },
  btnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.surface2,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.regular,
    paddingVertical: 12,
  },
  btnGhostText: {
    color: THEME.colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  infoRows: {
    borderRadius: THEME.radius.regular,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  infoLabel: {
    fontSize: 11,
    color: THEME.colors.text3,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14.5,
    color: THEME.colors.text,
    fontWeight: 'bold',
    marginTop: 2,
  },
  copyBtn: {
    padding: 8,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  noticeText: {
    fontSize: 11.5,
    color: THEME.colors.text3,
    flex: 1,
  },
  limitsForm: {
    gap: 20,
  },
  controlsList: {
    gap: 12,
  },
  controlToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  iconDesc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  controlCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  btnPrimary: {
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.radius.regular,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: THEME.colors.onAccent,
    fontSize: 15,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.text2,
  },
  amountInput: {
    backgroundColor: THEME.colors.surface2,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.regular,
    paddingVertical: 12,
    color: THEME.colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  quickChips: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    backgroundColor: THEME.colors.surface2,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.regular,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: 'bold',
    color: THEME.colors.text,
  },
});
