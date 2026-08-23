import * as SecureStore from "expo-secure-store";
import { setFeel } from "./feel";
import { BAG_LINES_MAX, BAG_QTY_MAX, LAST_CUPS_MAX, type LastCup, type Line } from "./house";

export type PayPref = "ask" | "stripe" | "counter";

export type Prefs = {
  haptics: boolean;
  night: boolean;
  pay: PayPref;
  bagNote: string;
  usualId: string;
  usualName: string;
  lastCups: LastCup[];
};

export type Held = {
  lines: Line[];
  note: string;
  forAt: string;
};

const KEY = "blanco.house.prefs";
const HELD_KEY = "blanco.house.held";

export const DEFAULT_PREFS: Prefs = {
  haptics: true,
  night: false,
  pay: "ask",
  bagNote: "",
  usualId: "",
  usualName: "",
  lastCups: []
};

function clean(raw: Partial<Prefs> | null | undefined): Prefs {
  const pay = raw?.pay;
  return {
    haptics: raw?.haptics !== false,
    night: raw?.night === true,
    pay: pay === "stripe" ? pay : "ask",
    bagNote: String(raw?.bagNote || "").slice(0, 140),
    usualId: String(raw?.usualId || "").trim().slice(0, 80),
    usualName: String(raw?.usualName || "").trim().slice(0, 80),
    lastCups: cleanCups(raw?.lastCups)
  };
}

function cleanCups(raw: unknown): LastCup[] {
  if (!Array.isArray(raw)) return [];
  const out: LastCup[] = [];
  raw.forEach((row) => {
    if (!row || typeof row !== "object") return;
    const next = row as Partial<LastCup>;
    const name = String(next.name || "").trim().slice(0, 80);
    const id = String(next.id || name).trim().slice(0, 80);
    if (!name) return;
    if (out.some((cup) => cup.name.toLowerCase() === name.toLowerCase())) return;
    if (out.length >= LAST_CUPS_MAX) return;
    out.push({ id: id || name, name });
  });
  return out;
}

export function hasUsual(prefs: Prefs) {
  return !!(prefs.usualId || prefs.usualName);
}

function cleanHeld(raw: unknown): Held {
  const data =
    raw && typeof raw === "object"
      ? (raw as { lines?: unknown; note?: unknown; forAt?: unknown; for?: unknown })
      : {};
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
  const forRaw = String(data.forAt || data.for || "").trim();
  const forAt = /^(\d{1,2}):(\d{2})$/.test(forRaw) ? forRaw : "";
  return { lines, note: String(data.note || "").slice(0, 140), forAt };
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
    return { lines: [], note: "", forAt: "" };
  }
}

export async function saveHeld(lines: Line[], note: string, forAt?: string | null): Promise<void> {
  const next = cleanHeld({ lines, note, forAt: forAt || "" });
  try {
    if (!next.lines.length && !next.note && !next.forAt) {
      await SecureStore.deleteItemAsync(HELD_KEY);
      return;
    }
    await SecureStore.setItemAsync(HELD_KEY, JSON.stringify(next));
  } catch {
    /* the phone would not keep it */
  }
}
