import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, KeyboardAvoidingView, Modal, PanResponder,
  Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Icon } from './Icon';
import { BankCard } from './BankCard';
import { money } from './UI';
import { useReducedMotion } from './Motion';
import { THEME } from '../theme';

const SCREEN_H = Dimensions.get('window').height;

// ── Bottom sheet: spring slide-up, fading scrim, drag-to-dismiss ────────
export function MobileSheet({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(open);
  const progress = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = shown
  const dragY = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (open) {
      setVisible(true);
      dragY.setValue(0);
      if (reduced) { progress.setValue(1); return; }
      progress.setValue(0);
      Animated.spring(progress, { toValue: 1, tension: 62, friction: 13, useNativeDriver: true }).start();
    } else if (visible) {
      if (reduced) { progress.setValue(0); setVisible(false); return; }
      Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true })
        .start(({ finished }) => { if (finished) setVisible(false); });
    }
  }, [open]);

  // Drag-to-dismiss is bound to the grab area (handle + header) only, so it
  // never fights with scrolling content inside the sheet.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) dragY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 0.8) onClose();
        else Animated.spring(dragY, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }).start();
      },
    })
  ).current;

  const slideUp = progress.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_H, 0] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close sheet" />
      </Animated.View>

      <KeyboardAvoidingView
        style={styles.sheetPositioner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[styles.sheetContainer, { transform: [{ translateY: Animated.add(slideUp, dragY) }] }]}
        >
          {/* Grab area: drag handle + title row */}
          <View {...panResponder.panHandlers}>
            <View style={styles.dragHandleWrapper}>
              <View style={styles.dragHandle} />
            </View>

            {!!title && (
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{title}</Text>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel="Close"
                  accessibilityRole="button"
                >
                  <Icon name="x" size={18} color={THEME.colors.text3} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Card detail sheet with reveal + real clipboard copy ─────────────────
export function MobileCardDetail({ card, open, onClose, wallets, fire }: {
  card: any;
  open: boolean;
  onClose: () => void;
  wallets: any[];
  fire: (t: string, b: string, type?: string) => void;
}) {
  const [revealed, setReveal] = useState(false);
  const wallet = wallets.find(w => w.id === card.walletId) || {};

  // Sensitive details never stay revealed across open/close cycles.
  useEffect(() => { if (!open) setReveal(false); }, [open]);

  const copy = async (text: string, label: string) => {
    try {
      await Clipboard.setStringAsync(text);
      fire('Copied', `${label} copied to clipboard.`, 'success');
    } catch {
      fire('Copy failed', 'Could not access the clipboard.', 'error');
    }
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
        <View style={styles.centerCard}>
          <BankCard card={card} revealed={revealed} />
        </View>

        <TouchableOpacity
          style={styles.btnGhost}
          onPress={() => setReveal(!revealed)}
          accessibilityLabel={revealed ? 'Hide sensitive details' : 'Reveal sensitive details'}
          accessibilityRole="button"
        >
          <Icon name={revealed ? 'eyeOff' : 'eye'} size={16} color={THEME.colors.text} />
          <Text style={styles.btnGhostText}>
            {revealed ? 'Hide sensitive details' : 'Tap to reveal details'}
          </Text>
        </TouchableOpacity>

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
                <TouchableOpacity
                  onPress={() => copy(r.copy, r.label)}
                  style={styles.copyBtn}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityLabel={`Copy ${r.label}`}
                  accessibilityRole="button"
                >
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

// ── Card Limits sheet ──────────────────────────────────────────────────
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
            accessibilityLabel="Monthly spending limit in euros"
          />
          <View style={styles.quickChips}>
            {[500, 1000, 2000, 5000].map(v => {
              const active = limitVal === v;
              return (
                <TouchableOpacity
                  key={v}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setLimitVal(v)}
                  accessibilityLabel={`Set limit to ${v} euros`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>€{v}</Text>
                </TouchableOpacity>
              );
            })}
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
              accessibilityLabel="Contactless payments"
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
              accessibilityLabel="Foreign transactions"
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => { onSaveLimits(limitVal); onClose(); fire('Settings saved', 'Your card controls have been updated.', 'success'); }}
          accessibilityLabel="Save card controls"
          accessibilityRole="button"
        >
          <Text style={styles.btnPrimaryText}>Save controls</Text>
        </TouchableOpacity>
      </View>
    </MobileSheet>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheetPositioner: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: THEME.colors.surface,
    borderTopLeftRadius: THEME.radius.xl,
    borderTopRightRadius: THEME.radius.xl,
    maxHeight: SCREEN_H * 0.88,
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
    backgroundColor: THEME.colors.surfaceHi,
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
    paddingBottom: 8,
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
    minHeight: 44,
  },
  chipActive: {
    borderColor: THEME.colors.accentLine,
    backgroundColor: THEME.colors.accentSoft,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: 'bold',
    color: THEME.colors.text,
  },
  chipTextActive: {
    color: THEME.colors.accent,
  },
});
