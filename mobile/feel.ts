import * as Haptics from "expo-haptics";

let allowed = true;

export function setFeel(on: boolean) {
  allowed = !!on;
}

export function tap() {
  if (!allowed) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function ok() {
  if (!allowed) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function warn() {
  if (!allowed) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
