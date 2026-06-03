import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Icon } from '../components/Icon';
import { money, Ring, catColor } from '../components/UI';
import { MobileSheet } from '../components/MobileExtras';
import { THEME } from '../theme';
import type { AppData } from '../../App';

interface Goal { id: string; name: string; target: number; saved: number; hue: number; icon: string; due: string; }

interface SavingsProps {
  data: AppData;
  fire: (t: string, b: string, type?: string) => void;
  goals: Goal[];
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
  wallets: any[];
  setWallets: React.Dispatch<React.SetStateAction<any[]>>;
  setTransactions: React.Dispatch<React.SetStateAction<any[]>>;
  token?: string | null;
  apiUrl?: string;
}

export function ScreenSavings({ data, fire, goals, setGoals, wallets, setWallets, setTransactions, token, apiUrl }: SavingsProps) {
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [addAmt, setAddAmt] = useState('');
  const [loading, setLoading] = useState(false);

  // New goal forms state
  const [newGoalOpen, setNewGoalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newIcon, setNewIcon] = useState('plane');
  const [newHue, setNewHue] = useState(12);

  const activeGoal = goals.find((g: any) => g.id === activeGoalId);

  const handleAddSavings = async () => {
    const val = parseFloat(addAmt);
    if (!val || val <= 0) { Alert.alert('Error', 'Please enter a valid amount.'); return; }

    setLoading(true);

    if (!token || token === 'mock-token') {
      setTimeout(() => {
        // 1. Deduct from checking wallet
        setWallets(prev => prev.map((w, idx) => idx === 0 ? { ...w, balance: Math.max(0, w.balance - val) } : w));

        // 2. Update goals state
        setGoals((prev: any[]) => prev.map((g: any) => {
          if (g.id === activeGoalId) {
            const saved = Math.min(g.target, g.saved + val);
            fire('Savings updated', `${money(val)} added to ${g.name}!`, 'success');
            return { ...g, saved };
          }
          return g;
        }));

        // 3. Inject transaction record
        setTransactions((prev: any[]) => [
          {
            id: 'tx-' + Date.now(),
            senderWalletId: wallets[0]?.id || 'mock-wallet-eur',
            receiverWalletId: null,
            amount: val,
            currency: 'EUR',
            status: 'confirmed',
            type: 'transfer',
            description: `Stashed to ${activeGoal?.name || 'Savings'}`,
            createdAt: new Date().toISOString()
          },
          ...prev
        ]);

        setLoading(false);
        setAddAmt('');
        setActiveGoalId(null);
      }, 800);
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/api/goals/${activeGoalId}/fund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount: val })
      });
      if (res.ok) {
        const { wallet, goal, transaction } = await res.json();
        setWallets(prev => prev.map(w => w.id === wallet.id ? wallet : w));
        setGoals(prev => prev.map(g => g.id === goal.id ? goal : g));
        setTransactions(prev => [transaction, ...prev]);
        fire('Savings updated', `${money(val)} added to ${goal.name}!`, 'success');
      } else {
        const err = await res.json();
        Alert.alert('Funding failed', err.message || 'Could not stash funds.');
      }
    } catch (e: any) {
      Alert.alert('Error', 'Failed to fund savings goal: ' + e.message);
    } finally {
      setLoading(false);
      setAddAmt('');
      setActiveGoalId(null);
    }
  };

  const handleCreateGoal = async () => {
    const tgt = parseFloat(newTarget);
    if (!newName || !tgt) return;

    if (!token || token === 'mock-token') {
      const newG = {
        id: 'g-' + Date.now(),
        name: newName,
        target: tgt,
        saved: 0,
        hue: newHue,
        icon: newIcon,
        due: 'No date',
      };
      setGoals(prev => [...prev, newG]);
      setNewGoalOpen(false);
      setNewName('');
      setNewTarget('');
      fire('Success', `Savings vault "${newName}" created successfully!`, 'success');
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/api/goals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newName,
          target: tgt,
          hue: newHue,
          icon: newIcon,
          due: 'No date'
        })
      });
      if (res.ok) {
        const goal = await res.json();
        setGoals(prev => [...prev, goal]);
        setNewGoalOpen(false);
        setNewName('');
        setNewTarget('');
        fire('Success', `Savings vault "${goal.name}" created successfully!`, 'success');
      }
    } catch (e: any) {
      Alert.alert('Error', 'Failed to create goal: ' + e.message);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header with New Goal button */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Goals</Text>
            <Text style={styles.subtitle}>Savings vaults and milestones.</Text>
          </View>
          <TouchableOpacity style={styles.newGoalBtn} onPress={() => setNewGoalOpen(true)}>
            <Icon name="plus" size={15} color={THEME.colors.onAccent} />
            <Text style={styles.newGoalBtnText}>New Goal</Text>
          </TouchableOpacity>
        </View>

        {/* Goals Grid */}
        <View style={styles.goalsContainer}>
          {goals.map((g: any) => {
            const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
            const done = pct >= 100;
            return (
              <TouchableOpacity key={g.id} activeOpacity={0.8} onPress={() => !done && setActiveGoalId(g.id)} style={[styles.card, styles.goalCard]}>
                <View style={styles.goalRow}>
                  <Ring pct={pct} size={54} thickness={6} color={catColor(g.hue)}>
                    <Icon name={g.icon} size={18} color={catColor(g.hue)} />
                  </Ring>
                  <View style={styles.goalMeta}>
                    <View style={styles.goalTitleRow}>
                      <Text style={styles.goalName}>{g.name}</Text>
                      {done ? (
                        <Text style={[styles.goalPct, { color: THEME.colors.pos }]}>Done</Text>
                      ) : (
                        <Text style={styles.goalPct}>{pct}%</Text>
                      )}
                    </View>
                    <Text style={styles.goalValues}>
                      {money(g.saved).replace('.00', '')} of {money(g.target).replace('.00', '')}
                    </Text>
                    <Text style={styles.goalDate}>Due {g.due}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
          {goals.length === 0 && (
            <Text style={{ color: THEME.colors.text3, textAlign: 'center', marginTop: 40 }}>No savings vaults created.</Text>
          )}
        </View>
      </ScrollView>

      {/* Add savings sheet */}
      <MobileSheet open={!!activeGoalId} onClose={() => setActiveGoalId(null)} title={activeGoal ? `Fund ${activeGoal.name}` : ''}>
        <View style={styles.sheetForm}>
          <Text style={styles.sheetDesc}>Transfer money from your Everyday account into this savings vault instantly.</Text>
          <Text style={styles.label}>Amount to transfer</Text>
          <TextInput
            style={styles.amountInput}
            value={addAmt}
            onChangeText={v => setAddAmt(v.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            placeholderTextColor={THEME.colors.text3}
            keyboardType="decimal-pad"
            autoFocus
          />

          <View style={styles.quickChips}>
            {[20, 50, 100, 250].map(v => (
              <TouchableOpacity key={v} style={styles.chip} onPress={() => setAddAmt(String(v))}>
                <Text style={styles.chipText}>+€{v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleAddSavings} disabled={loading || !addAmt}>
            <Text style={styles.submitText}>{loading ? 'Processing…' : 'Add funds'}</Text>
          </TouchableOpacity>
        </View>
      </MobileSheet>

      {/* Create savings goal sheet */}
      <MobileSheet open={newGoalOpen} onClose={() => setNewGoalOpen(false)} title="Create a Savings Goal">
        <View style={styles.sheetForm}>
          <Text style={styles.sheetDesc}>Set a new savings target and choose your theme.</Text>

          <Text style={styles.label}>Goal Name</Text>
          <TextInput
            style={styles.field}
            value={newName}
            onChangeText={setNewName}
            placeholder="e.g. Vacation, emergency fund"
            placeholderTextColor={THEME.colors.text3}
          />

          <Text style={styles.label}>Target Amount (€)</Text>
          <TextInput
            style={styles.field}
            value={newTarget}
            onChangeText={v => setNewTarget(v.replace(/[^0-9.]/g, ''))}
            placeholder="0.00"
            placeholderTextColor={THEME.colors.text3}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Icon</Text>
          <View style={styles.quickChips}>
            {['plane', 'shield', 'laptop', 'car', 'heart'].map(ic => (
              <TouchableOpacity
                key={ic}
                style={[styles.iconChip, newIcon === ic && styles.iconChipActive]}
                onPress={() => setNewIcon(ic)}
              >
                <Icon name={ic} size={16} color={newIcon === ic ? THEME.colors.accent : THEME.colors.text2} />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Design Color</Text>
          <View style={styles.colorChipsGrid}>
            {[12, 158, 230, 265, 320].map(h => (
              <TouchableOpacity
                key={h}
                style={[styles.colorChip, newHue === h && styles.colorChipActive]}
                onPress={() => setNewHue(h)}
              >
                <Text style={[styles.colorChipText, newHue === h && styles.colorChipTextActive]}>
                  Hue {h}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, (!newName || !parseFloat(newTarget)) && { opacity: 0.5 }]}
            onPress={handleCreateGoal}
            disabled={!newName || !parseFloat(newTarget)}
          >
            <Text style={styles.submitText}>Create Goal</Text>
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
  newGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.radius.xs,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  newGoalBtnText: {
    color: THEME.colors.onAccent,
    fontSize: 12.5,
    fontWeight: 'bold',
  },
  goalsContainer: {
    gap: 12,
  },
  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.line,
  },
  goalCard: {
    padding: 16,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
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
    fontSize: 15,
    fontWeight: 'bold',
    color: THEME.colors.text,
  },
  goalPct: {
    fontSize: 14,
    fontWeight: 'bold',
    color: THEME.colors.text,
  },
  goalValues: {
    fontSize: 13,
    color: THEME.colors.text2,
    marginTop: 4,
  },
  goalDate: {
    fontSize: 11,
    color: THEME.colors.text3,
    marginTop: 4,
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
  iconChip: {
    flex: 1,
    backgroundColor: THEME.colors.surface2,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.regular,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconChipActive: {
    borderColor: THEME.colors.accent,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  colorChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorChip: {
    flex: 1,
    minWidth: '18%',
    backgroundColor: THEME.colors.surface2,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    borderRadius: THEME.radius.regular,
    paddingVertical: 10,
    alignItems: 'center',
  },
  colorChipActive: {
    borderColor: THEME.colors.accent,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  colorChipText: {
    color: THEME.colors.text2,
    fontSize: 12.5,
    fontWeight: '600',
  },
  colorChipTextActive: {
    color: THEME.colors.accent,
    fontWeight: 'bold',
  },
  submitBtn: {
    backgroundColor: THEME.colors.accent,
    borderRadius: THEME.radius.regular,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: {
    color: THEME.colors.onAccent,
    fontSize: 15,
    fontWeight: 'bold',
  },
});
