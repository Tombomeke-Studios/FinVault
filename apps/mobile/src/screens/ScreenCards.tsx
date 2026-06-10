import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput, Animated, Pressable } from 'react-native';
import { Icon } from '../components/Icon';
import { BankCard, CARD_SCHEMES } from '../components/BankCard';
import { MobileCardDetail, LimitsSheet, MobileSheet } from '../components/MobileExtras';
import { useReducedMotion } from '../components/Motion';
import { THEME } from '../theme';
import { money, Ring } from '../components/UI';
import type { AppData } from '../../App';

/* Animated selection state for the stacked card list. */
function CardStackItem({ active, onPress, label, children }: {
  active: boolean;
  onPress: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) { anim.setValue(active ? 1 : 0); return; }
    Animated.spring(anim, { toValue: active ? 1 : 0, tension: 55, friction: 10, useNativeDriver: true }).start();
  }, [active, reduced]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Animated.View style={{
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
      }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

interface CardsProps {
  data: AppData;
  fire: (t: string, b: string, type?: string) => void;
  cards: any[];
  setCards: React.Dispatch<React.SetStateAction<any[]>>;
  token?: string | null;
  apiUrl?: string;
  navigate?: (r: string) => void;
}

export function ScreenCards({ data, fire, cards, setCards, token, apiUrl, navigate }: CardsProps) {
  const [selCardIdx, setSelCardIdx] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [newCardOpen, setNewCardOpen] = useState(false);

  // New card forms state
  const [newCardName, setNewCardName] = useState('');
  const [newCardKind, setNewCardKind] = useState<'physical' | 'virtual'>('virtual');
  const [newCardScheme, setNewCardScheme] = useState('violet');

  const activeCard = cards[selCardIdx] || cards[0];

  const toggleFreeze = async (id: string) => {
    if (!token || token === 'mock-token') {
      setCards((prev: any[]) => prev.map((c: any) => {
        if (c.id === id) {
          const frozen = !c.frozen;
          fire(frozen ? 'Card frozen' : 'Card unfrozen', frozen ? 'Payments temporarily locked.' : 'Payments re-enabled.', 'success');
          return { ...c, frozen };
        }
        return c;
      }));
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/api/cards/${id}/freeze`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ frozen: !activeCard.frozen })
      });
      if (res.ok) {
        const updated = await res.json();
        setCards(prev => prev.map(c => c.id === id ? updated : c));
        fire(updated.frozen ? 'Card frozen' : 'Card unfrozen', updated.frozen ? 'Payments temporarily locked.' : 'Payments re-enabled.', 'success');
      }
    } catch (e: any) {
      fire('Error', 'Failed to toggle card lock: ' + e.message, 'error');
    }
  };

  const handleOrderCard = async () => {
    if (!token || token === 'mock-token') {
      const last4 = Math.floor(1000 + Math.random() * 9000).toString();
      const newCard = {
        id: 'card-' + Date.now(),
        name: newCardName,
        kind: newCardKind,
        network: newCardKind === 'physical' ? 'Visa' : 'Mastercard',
        last4,
        number: `4182 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)} ${last4}`,
        cvv: Math.floor(100 + Math.random() * 900).toString(),
        holder: activeCard?.holder || `${data.user.firstName} ${data.user.lastName}`,
        exp: (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 5); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`; })(),
        frozen: false,
        scheme: newCardScheme,
        walletId: activeCard?.walletId || data.wallets[0]?.id || 'mock-wallet-eur',
        monthSpend: 0,
        limit: 2000,
      };
      setCards(prev => [...prev, newCard]);
      setNewCardOpen(false);
      setNewCardName('');
      setSelCardIdx(cards.length); // Switch select to the new card
      fire('Success', `Your new ${newCardKind} card (${newCardName}) has been created!`, 'success');
      return;
    }

    try {
      const walletId = data.wallets[0]?.id;
      const res = await fetch(`${apiUrl}/api/cards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newCardName,
          kind: newCardKind,
          scheme: newCardScheme,
          walletId,
          limit: 2000,
          holder: `${data.user.firstName} ${data.user.lastName}`
        })
      });
      if (res.ok) {
        const created = await res.json();
        setCards(prev => [...prev, created]);
        setNewCardOpen(false);
        setNewCardName('');
        setSelCardIdx(cards.length);
        fire('Success', `Your new ${created.kind} card (${created.name}) has been ordered!`, 'success');
      }
    } catch (e: any) {
      fire('Error', 'Failed to order card: ' + e.message, 'error');
    }
  };

  const handleSaveLimits = async (newLimit: number) => {
    if (!token || token === 'mock-token') {
      setCards(cs => cs.map((c, i) => i === selCardIdx ? { ...c, limit: newLimit } : c));
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/api/cards/${activeCard.id}/limit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ limit: newLimit })
      });
      if (res.ok) {
        const updated = await res.json();
        setCards(prev => prev.map(c => c.id === activeCard.id ? updated : c));
        fire('Success', `Cap limit updated to ${money(updated.limit)}.`, 'success');
      }
    } catch (e: any) {
      fire('Error', 'Failed to save limits: ' + e.message, 'error');
    }
  };

  if (!activeCard) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={{ color: THEME.colors.text3, textAlign: 'center', marginTop: 40 }}>No cards available.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header with New Card button */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Cards</Text>
            <Text style={styles.subtitle}>Physical and virtual vault cards.</Text>
          </View>
          <TouchableOpacity style={styles.newCardBtn} onPress={() => setNewCardOpen(true)}>
            <Icon name="plus" size={15} color={THEME.colors.onAccent} />
            <Text style={styles.newCardBtnText}>New Card</Text>
          </TouchableOpacity>
        </View>

        {/* Card visual stack */}
        <View style={styles.cardContainer}>
          {cards.map((c: any, i: number) => (
            <CardStackItem
              key={c.id}
              active={i === selCardIdx}
              onPress={() => setSelCardIdx(i)}
              label={`${c.name} card ending in ${c.last4}`}
            >
              <BankCard card={c} />
            </CardStackItem>
          ))}
        </View>

        {/* Spent Progress ring & details indicator */}
        <View style={[styles.cardBg, styles.spendCard]}>
          <View style={styles.ringWrapper}>
            <Ring pct={activeCard.limit > 0 ? Math.min(100, (activeCard.monthSpend / activeCard.limit) * 100) : 0} size={82} thickness={8}>
              <Text style={styles.ringPct}>{activeCard.limit > 0 ? Math.round(Math.min(100, (activeCard.monthSpend / activeCard.limit) * 100)) : 0}%</Text>
            </Ring>
          </View>
          <View style={styles.spendInfo}>
            <Text style={styles.spendEyebrow}>Spent this month</Text>
            <Text style={styles.spendAmt}>{money(activeCard.monthSpend)}</Text>
            <Text style={styles.spendLimit}>of {money(activeCard.limit)} monthly limit</Text>
          </View>
        </View>

        {/* Action Controls */}
        <View style={[styles.cardBg, styles.controlsCard]}>
          <View style={styles.controlRow}>
            <View style={styles.controlLabelCol}>
              <View style={[styles.controlCircle, { backgroundColor: activeCard.frozen ? 'rgba(248, 113, 113, 0.16)' : 'rgba(52, 211, 153, 0.16)' }]}>
                <Icon name="snow" size={16} color={activeCard.frozen ? THEME.colors.neg : THEME.colors.accent} />
              </View>
              <View>
                <Text style={styles.controlTitle}>Freeze Card</Text>
                <Text style={styles.controlDesc}>Temporarily lock this card</Text>
              </View>
            </View>
            <Switch
              value={activeCard.frozen}
              onValueChange={() => toggleFreeze(activeCard.id)}
              trackColor={{ false: THEME.colors.surfaceHi, true: THEME.colors.accent }}
              thumbColor="#fff"
            />
          </View>

          <TouchableOpacity style={styles.controlRow} onPress={() => setDetailsOpen(true)}>
            <View style={styles.controlLabelCol}>
              <View style={[styles.controlCircle, { backgroundColor: 'rgba(168, 85, 247, 0.16)' }]}>
                <Icon name="eye" size={16} color="#c084fc" />
              </View>
              <View>
                <Text style={styles.controlTitle}>View Card Details</Text>
                <Text style={styles.controlDesc}>Reveal card number, CVV, and expiry</Text>
              </View>
            </View>
            <Icon name="chevRight" size={18} color={THEME.colors.text3} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.controlRow, { borderBottomWidth: 0 }]} onPress={() => setLimitsOpen(true)}>
            <View style={styles.controlLabelCol}>
              <View style={[styles.controlCircle, { backgroundColor: 'rgba(14, 165, 233, 0.16)' }]}>
                <Icon name="settings" size={16} color="#38bdf8" />
              </View>
              <View>
                <Text style={styles.controlTitle}>Card Limits & Controls</Text>
                <Text style={styles.controlDesc}>Set spending limits & switch features</Text>
              </View>
            </View>
            <Icon name="chevRight" size={18} color={THEME.colors.text3} />
          </TouchableOpacity>

          {activeCard.walletId && navigate && (
            <TouchableOpacity
              style={[styles.controlRow, { borderTopWidth: 1, borderTopColor: THEME.colors.line, borderBottomWidth: 0 }]}
              onPress={() => navigate(`account:${activeCard.walletId}`)}
            >
              <View style={styles.controlLabelCol}>
                <View style={[styles.controlCircle, { backgroundColor: 'rgba(52,211,153,0.14)' }]}>
                  <Icon name="card" size={16} color={THEME.colors.accent} />
                </View>
                <View>
                  <Text style={styles.controlTitle}>View Linked Account</Text>
                  <Text style={styles.controlDesc}>Balance, activity & add money</Text>
                </View>
              </View>
              <Icon name="chevRight" size={18} color={THEME.colors.text3} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* 3D Flip Card Details overlay sheet */}
      <MobileCardDetail
        card={activeCard}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        wallets={data.wallets}
        fire={fire}
      />

      {/* Card limits sliding sheet */}
      <LimitsSheet
        card={activeCard}
        open={limitsOpen}
        onClose={() => setLimitsOpen(false)}
        fire={fire}
        onSaveLimits={handleSaveLimits}
      />

      {/* Order New Card sliding sheet */}
      <MobileSheet open={newCardOpen} onClose={() => setNewCardOpen(false)} title="Order a New Card">
        <View style={styles.sheetForm}>
          <Text style={styles.sheetDesc}>Design your virtual or physical FinVault card instantly.</Text>

          <Text style={styles.label}>Card Nickname</Text>
          <TextInput
            style={styles.field}
            value={newCardName}
            onChangeText={setNewCardName}
            placeholder="e.g. Subscriptions, Groceries"
            placeholderTextColor={THEME.colors.text3}
          />

          <Text style={styles.label}>Card Type</Text>
          <View style={styles.quickChips}>
            {(['physical', 'virtual'] as const).map(k => (
              <TouchableOpacity
                key={k}
                style={[styles.typeBtn, newCardKind === k && styles.typeBtnActive]}
                onPress={() => setNewCardKind(k)}
                accessibilityRole="button"
                accessibilityState={{ selected: newCardKind === k }}
              >
                <Icon
                  name={k === 'physical' ? 'card' : 'smartphone'}
                  size={15}
                  color={newCardKind === k ? THEME.colors.accent : THEME.colors.text2}
                />
                <Text style={[styles.typeBtnText, newCardKind === k && styles.typeBtnTextActive]}>
                  {k === 'physical' ? 'Physical' : 'Virtual'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Card Design & Color</Text>
          <View style={styles.quickChipsGrid}>
            {Object.keys(CARD_SCHEMES).map(sc => {
              const scheme = CARD_SCHEMES[sc];
              const selected = newCardScheme === sc;
              return (
                <TouchableOpacity
                  key={sc}
                  style={[styles.colorChip, selected && styles.colorChipActive]}
                  onPress={() => setNewCardScheme(sc)}
                  accessibilityRole="button"
                  accessibilityLabel={`${sc} card design`}
                  accessibilityState={{ selected }}
                >
                  <View style={[styles.colorPreview, { backgroundColor: scheme.bg, borderColor: scheme.accent }]}>
                    {selected && <Icon name="check" size={12} color={scheme.accent} />}
                  </View>
                  <Text style={[styles.colorChipText, selected && styles.colorChipTextActive]}>
                    {sc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, !newCardName && { opacity: 0.5 }]}
            onPress={handleOrderCard}
            disabled={!newCardName}
            accessibilityRole="button"
            accessibilityState={{ disabled: !newCardName }}
          >
            <Text style={styles.submitBtnText}>Order Card</Text>
          </TouchableOpacity>
        </View>
      </MobileSheet>
    </View>
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
    paddingBottom: 88,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  newCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.radius.regular,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  newCardBtnText: {
    color: THEME.colors.onAccent,
    fontSize: 12.5,
    fontWeight: 'bold',
  },
  cardContainer: {
    gap: 12,
  },
  cardBg: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  spendCard: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ringWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringPct: {
    fontSize: 14,
    fontWeight: 'bold',
    color: THEME.colors.text,
  },
  spendInfo: {
    flex: 1,
  },
  spendEyebrow: {
    fontSize: 11,
    color: THEME.colors.text3,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  spendAmt: {
    fontSize: 22,
    fontWeight: 'bold',
    color: THEME.colors.text,
    marginTop: 2,
  },
  spendLimit: {
    fontSize: 12,
    color: THEME.colors.text2,
    marginTop: 2,
  },
  controlsCard: {
    padding: 8,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.line,
  },
  controlLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  controlCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  controlDesc: {
    fontSize: 12,
    color: THEME.colors.text3,
    marginTop: 2,
  },
  sheetForm: {
    gap: 16,
    paddingVertical: 8,
  },
  sheetDesc: {
    fontSize: 13.5,
    color: THEME.colors.text2,
    lineHeight: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text2,
    textTransform: 'uppercase',
  },
  field: {
    backgroundColor: THEME.colors.surface2,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.regular,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: THEME.colors.text,
    fontSize: 15,
  },
  quickChips: {
    flexDirection: 'row',
    gap: 10,
  },
  quickChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    backgroundColor: THEME.colors.surface2,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.regular,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBtnActive: {
    borderColor: THEME.colors.accent,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  typeBtnText: {
    color: THEME.colors.text2,
    fontSize: 13.5,
    fontWeight: '600',
  },
  typeBtnTextActive: {
    color: THEME.colors.accent,
    fontWeight: 'bold',
  },
  colorChip: {
    flex: 1,
    minWidth: '28%',
    backgroundColor: THEME.colors.surface2,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.regular,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 6,
  },
  colorPreview: {
    width: 34,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorChipActive: {
    borderColor: THEME.colors.accent,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  colorChipText: {
    color: THEME.colors.text2,
    fontSize: 12.5,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  colorChipTextActive: {
    color: THEME.colors.accent,
    fontWeight: 'bold',
  },
  submitBtn: {
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.radius.regular,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: THEME.colors.onAccent,
    fontSize: 15,
    fontWeight: 'bold',
  },
});
