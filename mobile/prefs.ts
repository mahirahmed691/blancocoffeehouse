import * as SecureStore from "expo-secure-store";
import { setFeel } from "./feel";
import { BAG_LINES_MAX, BAG_QTY_MAX, type Line } from "./house";

export type PayPref = "ask" | "stripe" | "counter";

export type Prefs = {
  haptics: boolean;
  night: boolean;
  pay: PayPref;
  bagNote: string;
};

export type Held = {
  lines: Line[];
  note: string;
};

const KEY = "blanco.house.prefs";
const HELD_KEY = "blanco.house.held";

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
    pay: pay === "stripe" ? pay : "ask",
    bagNote: String(raw?.bagNote || "").slice(0, 140)
  };
}

function cleanHeld(raw: unknown): Held {
  const data = raw && typeof raw === "object" ? (raw as { lines?: unknown; note?: unknown }) : {};
  const lines: Line[] = [];
  if (Array.isArray(data.lines)) {
    data.lines.forEach((row) => {
      if (!row || typeof row !== "object") return;
      const next = row as Partial<Line>;
      const id = String(next.id || "").trim();
      const name = String(next.name || "").trim();
      const price = Number(next.price_gbp);
      const qty = Math.min(BAG_QTY_MAX, Math.max(1, Math.round(Number(next.qty) || 0)));
      if (!id || !name || !isFinite(price) || price < 0 || qty < 1) return;
      if (lines.some((line) => line.id === id) || lines.length >= BAG_LINES_MAX) return;
      lines.push({
        id,
        name,
        price_gbp: price,
        qty,
        rank: next.rank === true
      });
    });
  }
  return { lines, note: String(data.note || "").slice(0, 140) };
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

export async function loadHeld(): Promise<Held> {
  try {
    const raw = await SecureStore.getItemAsync(HELD_KEY);
    return cleanHeld(raw ? JSON.parse(raw) : null);
  } catch {
    return { lines: [], note: "" };
  }
}

export async function saveHeld(lines: Line[], note: string): Promise<void> {
  const next = cleanHeld({ lines, note });
  try {
    if (!next.lines.length && !next.note) {
      await SecureStore.deleteItemAsync(HELD_KEY);
      return;
    }
    await SecureStore.setItemAsync(HELD_KEY, JSON.stringify(next));
  } catch {
    /* the phone would not keep it */
  }
}
