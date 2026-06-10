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

  // Edit goal state
  const [editGoalId, setEditGoalId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editDue, setEditDue] = useState('');
  const [editIcon, setEditIcon] = useState('plane');
  const [editHue, setEditHue] = useState(12);
  const editGoal = goals.find((g: any) => g.id === editGoalId);

  const openEdit = (g: any) => {
    setEditGoalId(g.id);
    setEditName(g.name);
    setEditTarget(String(g.target));
    setEditDue(g.due === 'No date' ? '' : g.due);
    setEditIcon(g.icon);
    setEditHue(g.hue);
  };

  const handleEditGoal = async () => {
    const tgt = parseFloat(editTarget);
    if (!editGoalId || !editName || !tgt) return;

    if (!token || token === 'mock-token') {
      setGoals((prev: any[]) => prev.map((g: any) => g.id === editGoalId ? {
        ...g, name: editName, target: tgt, icon: editIcon, hue: editHue,
        due: editDue || 'No date',
      } : g));
      fire('Goal updated', `"${editName}" has been saved.`, 'success');
      setEditGoalId(null);
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/api/goals/${editGoalId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName,
          target: tgt,
          hue: editHue,
          icon: editIcon,
          due: editDue || 'No date'
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setGoals((prev: any[]) => prev.map((g: any) => g.id === editGoalId ? updated : g));
        fire('Goal updated', `"${editName}" has been saved.`, 'success');
        setEditGoalId(null);
      } else {
        const err = await res.json();
        Alert.alert('Error', err.error || 'Failed to update goal');
      }
    } catch (e: any) {
      Alert.alert('Error', 'Failed to update goal: ' + e.message);
    }
  };

  const handleDeleteGoal = (g: any) => {
    Alert.alert('Delete goal', `Remove "${g.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        if (!token || token === 'mock-token') {
          setGoals((prev: any[]) => prev.filter((x: any) => x.id !== g.id));
          fire('Goal removed', `"${g.name}" has been deleted.`, 'info');
          return;
        }

        try {
          const res = await fetch(`${apiUrl}/api/goals/${g.id}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          if (res.ok) {
            setGoals((prev: any[]) => prev.filter((x: any) => x.id !== g.id));
            const walletsRes = await fetch(`${apiUrl}/api/wallets`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (walletsRes.ok) {
              setWallets(await walletsRes.json());
            }
            fire('Goal removed', `"${g.name}" has been deleted.`, 'info');
          } else {
            const err = await res.json();
            Alert.alert('Error', err.error || 'Failed to delete goal');
          }
        } catch (e: any) {
          Alert.alert('Error', 'Failed to delete goal: ' + e.message);
        }
      }},
    ]);
  };

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
              <View key={g.id} style={[styles.card, styles.goalCard]}>
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
                        <Text style={[styles.goalPct, { color: catColor(g.hue) }]}>{pct}%</Text>
                      )}
                    </View>
                    <Text style={styles.goalValues}>
                      {money(g.saved).replace('.00', '')} of {money(g.target).replace('.00', '')}
                    </Text>
                    <Text style={styles.goalDate}>Due {g.due}</Text>
                  </View>
                </View>
                {/* Progress bar */}
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: catColor(g.hue) }]} />
                </View>
                {/* Action buttons */}
                <View style={styles.goalActions}>
                  <TouchableOpacity style={[styles.goalActionBtn, styles.goalActionPrimary]} onPress={() => !done && setActiveGoalId(g.id)} disabled={done} activeOpacity={0.8}>
                    <Icon name="plus" size={14} color={THEME.colors.onAccent} />
                    <Text style={styles.goalActionPrimaryText}>Add funds</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.goalActionIcon} onPress={() => openEdit(g)} activeOpacity={0.7}>
                    <Icon name="edit" size={15} color={THEME.colors.text2} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.goalActionIcon, { borderColor: 'rgba(248,113,113,0.3)' }]} onPress={() => handleDeleteGoal(g)} activeOpacity={0.7}>
                    <Icon name="trash" size={15} color={THEME.colors.neg} />
                  </TouchableOpacity>
                </View>
              </View>
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

      {/* Edit goal sheet */}
      <MobileSheet open={!!editGoalId} onClose={() => setEditGoalId(null)} title="Edit Goal">
        <View style={styles.sheetForm}>
          <Text style={styles.label}>Goal name</Text>
          <TextInput style={styles.field} value={editName} onChangeText={setEditName} placeholder="e.g. Japan Trip" placeholderTextColor={THEME.colors.text3} autoFocus />
          <Text style={styles.label}>Target amount (€)</Text>
          <TextInput style={styles.field} value={editTarget} onChangeText={v => setEditTarget(v.replace(/[^0-9.]/g, ''))} placeholder="0.00" placeholderTextColor={THEME.colors.text3} keyboardType="decimal-pad" />
          <Text style={styles.label}>Due date</Text>
          <TextInput style={styles.field} value={editDue} onChangeText={setEditDue} placeholder="e.g. Dec 2025, No date" placeholderTextColor={THEME.colors.text3} />
          <Text style={styles.label}>Icon</Text>
          <View style={styles.quickChips}>
            {['plane', 'shield', 'laptop', 'car', 'heart', 'gift', 'globe', 'flame'].map(ic => (
              <TouchableOpacity key={ic} style={[styles.iconChip, editIcon === ic && styles.iconChipActive]} onPress={() => setEditIcon(ic)}>
                <Icon name={ic} size={16} color={editIcon === ic ? THEME.colors.accent : THEME.colors.text2} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Color</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[12, 158, 195, 230, 265, 300, 320].map(h => (
              <TouchableOpacity key={h} onPress={() => setEditHue(h)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: `hsl(${h}, 70%, 55%)`, borderWidth: editHue === h ? 3 : 2, borderColor: editHue === h ? THEME.colors.text : 'transparent' }} />
            ))}
          </View>
          <TouchableOpacity style={[styles.submitBtn, (!editName || !parseFloat(editTarget)) && { opacity: 0.5 }]} onPress={handleEditGoal} disabled={!editName || !parseFloat(editTarget)}>
            <Text style={styles.submitText}>Save changes</Text>
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
          <View style={styles.colorSwatchRow}>
            {[12, 158, 230, 265, 320].map(h => (
              <TouchableOpacity
                key={h}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: `hsl(${h}, 70%, 55%)` },
                  newHue === h && styles.colorSwatchActive,
                ]}
                onPress={() => setNewHue(h)}
              />
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
    borderRadius: THEME.radius.regular,
    paddingVertical: 9,
    paddingHorizontal: 14,
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  goalCard: {
    padding: 16,
    gap: 12,
  },
  progressBg: {
    height: 8,
    borderRadius: 99,
    backgroundColor: THEME.colors.surfaceHi,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
  },
  goalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  goalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: THEME.radius.regular,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    backgroundColor: THEME.colors.surface2,
  },
  goalActionPrimary: {
    backgroundColor: THEME.colors.accent,
    borderColor: 'transparent',
  },
  goalActionPrimaryText: {
    color: THEME.colors.onAccent,
    fontSize: 13,
    fontWeight: '700',
  },
  goalActionIcon: {
    width: 42,
    height: 42,
    borderRadius: THEME.radius.regular,
    borderWidth: 1,
    borderColor: THEME.colors.line,
    backgroundColor: THEME.colors.surface2,
    justifyContent: 'center',
    alignItems: 'center',
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
  colorSwatchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  colorSwatch: {
    flex: 1,
    height: 44,
    borderRadius: THEME.radius.regular,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: THEME.colors.text,
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
