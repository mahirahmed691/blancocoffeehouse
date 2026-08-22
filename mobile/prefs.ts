import * as SecureStore from "expo-secure-store";
import { setFeel } from "./feel";

export type PayPref = "ask" | "stripe" | "counter";

export type Prefs = {
  haptics: boolean;
  night: boolean;
  pay: PayPref;
  bagNote: string;
};

const KEY = "blanco.house.prefs";

export const DEFAULT_PREFS: Prefs = {
  haptics: true,
  night: false,
  pay: "ask",
  bagNote: ""
};

function clean(raw: Partial<Prefs> | null | undefined): Prefs {
  const pay = raw?.pay;
  return {
    haptics: raw?.haptics !== false,
    night: raw?.night === true,
    pay: pay === "stripe" || pay === "counter" ? pay : "ask",
    bagNote: String(raw?.bagNote || "").slice(0, 140)
  };
}

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    const next = clean(raw ? JSON.parse(raw) : null);
    setFeel(next.haptics);
    return next;
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function savePrefs(next: Prefs): Promise<Prefs> {
  const cleanNext = clean(next);
  setFeel(cleanNext.haptics);
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(cleanNext));
  } catch {
    /* the phone would not keep it */
  }
  return cleanNext;
}
