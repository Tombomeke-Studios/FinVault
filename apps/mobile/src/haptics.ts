// Haptic vocabulary (#125). One place decides what each moment feels like,
// so the whole app ticks and thuds consistently, the way Revolut does:
//   tap      light tick on any press
//   select   crisp click when a choice changes (tabs, pickers, toggles)
//   success  double-pulse when something worked (money sent, plan changed)
//   warning  for a refused action (declined charge, validation)
//   error    for a failure (server unreachable)
// Every call is fire-and-forget; a phone without a vibration motor just ignores it.

import * as Haptics from 'expo-haptics';

const quiet = (p: Promise<unknown>) => { p.catch(() => {}); };

export const haptic = {
  tap: () => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  heavy: () => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  select: () => quiet(Haptics.selectionAsync()),
  success: () => quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => quiet(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
