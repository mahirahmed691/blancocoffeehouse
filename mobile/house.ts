import { HOUSE_SITE } from "./pieces";

export const SUPABASE_URL = "https://lqswuhjwtaygixmjejmd.supabase.co";
export const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxxc3d1aGp3dGF5Z2l4bWplam1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMzg0MjgsImV4cCI6MjEwMjkxNDQyOH0.D_cs7MBPV6MmGo3uLb3BHldt0isbjY_Tx4viCa0dRj0";

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price_gbp: number;
  driver_price_gbp: number | null;
  board: string;
  section: string | null;
  sold_out: boolean;
  sort: number;
  allergens?: string[] | null;
};

export const HOUSE_TAGS = ["dairy", "oat", "nuts", "gluten", "sesame"] as const;
export type HouseTag = (typeof HOUSE_TAGS)[number];

export function houseTags(item: MenuItem): HouseTag[] {
  const raw = item.allergens;
  if (!Array.isArray(raw) || !raw.length) return [];
  return HOUSE_TAGS.filter((tag) => raw.indexOf(tag) !== -1);
}

export type MenuSection = {
  title: string;
  items: MenuItem[];
};

export type HouseHours = {
  hours_line: string;
  hours_days: string;
  hours_range: string;
  notice: string;
  how_busy?: string;
  how_wait?: string;
  pace_at?: string;
  opens?: string;
  closes?: string;
};

export type HowBusy = "quiet" | "easy" | "busy" | "packed";
export type HowWait = "flowing" | "short" | "queue";

export const HOW_BUSY: { id: HowBusy; label: string; line: string }[] = [
  { id: "quiet", label: "quiet", line: "quiet. seats are easy." },
  { id: "easy", label: "easy", line: "a few in. the room is easy." },
  { id: "busy", label: "busy", line: "busy. a short wait for a seat." },
  { id: "packed", label: "packed", line: "packed. takeaway is quicker." }
];

export const HOW_WAIT: { id: HowWait; label: string; line: string }[] = [
  { id: "flowing", label: "flowing", line: "the counter is flowing." },
  { id: "short", label: "short", line: "a short wait for a cup." },
  { id: "queue", label: "queue", line: "a queue at the counter." }
];

function londonDay(at = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(at);
}

export function paceStale(hours: HouseHours | null) {
  if (!hours?.pace_at) return true;
  const at = new Date(hours.pace_at);
  if (Number.isNaN(at.getTime())) return true;
  return londonDay(at) !== londonDay();
}

export function houseBusyLine(hours: HouseHours | null) {
  if (!hours || houseState(hours) === "closed") return "";
  const parts: string[] = [];
  if (houseState(hours) === "closing") parts.push("closing soon. last cups.");
  if (!paceStale(hours)) {
    const room = HOW_BUSY.find((row) => row.id === hours.how_busy);
    const wait = HOW_WAIT.find((row) => row.id === hours.how_wait);
    if (room) parts.push(room.line);
    if (wait) parts.push(wait.line);
  }
  return parts.join(" ");
}

export function counterCue(orders: HouseOrder[]) {
  if (liveOrders(orders).length >= 3) return "a few collections at the counter.";
  return "";
}

function minutesInLondon(at: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23"
  }).formatToParts(at);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!isFinite(hour) || !isFinite(minute)) return 0;
  return hour * 60 + minute;
}

function parseMinutes(value?: string | null) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function houseState(
  hours: HouseHours | null,
  at = new Date()
): "open" | "closing" | "closed" {
  const openAt = parseMinutes(hours?.opens) ?? 11 * 60;
  const closeAt = parseMinutes(hours?.closes) ?? 20 * 60;
  const now = minutesInLondon(at);
  if (now < openAt || now >= closeAt) return "closed";
  if (closeAt - now <= 30) return "closing";
  return "open";
}

export function houseOpenLine(hours: HouseHours | null) {
  const range = hours?.hours_range || "11am–8pm";
  const state = houseState(hours);
  if (state === "open") return "Open now · " + range;
  if (state === "closing") return "Closing soon · " + range;
  return "Closed now · " + range;
}

const PICKUP_SLOT = 15;

function padClock(n: number) {
  return String(n).padStart(2, "0");
}

export function clockLabel(minutes: number) {
  let hour = Math.floor(minutes / 60) % 12;
  if (hour === 0) hour = 12;
  return hour + ":" + padClock(minutes % 60);
}

export type PickupSlot = {
  minutes: number;
  hm: string;
  label: string;
  line: string;
};

export function pickupSlots(hours: HouseHours | null, at = new Date()): PickupSlot[] {
  const openAt = parseMinutes(hours?.opens) ?? 11 * 60;
  const closeAt = parseMinutes(hours?.closes) ?? 20 * 60;
  const now = minutesInLondon(at);
  if (now >= closeAt) return [];
  const start = now < openAt ? openAt : Math.ceil((now + 1) / PICKUP_SLOT) * PICKUP_SLOT;
  const out: PickupSlot[] = [];
  for (let m = start; m < closeAt; m += PICKUP_SLOT) {
    out.push({
      minutes: m,
      hm: padClock(Math.floor(m / 60)) + ":" + padClock(m % 60),
      label: clockLabel(m),
      line: "for " + clockLabel(m) + "."
    });
  }
  return out;
}

export function pickupWhen(order: { for_at?: string | null }) {
  if (!order.for_at) return "";
  const at = new Date(order.for_at);
  if (Number.isNaN(at.getTime())) return "";
  return "for " + clockLabel(minutesInLondon(at));
}

export function pickupLine(order: { for_at?: string | null }) {
  const when = pickupWhen(order);
  return when ? when + "." : "when it's ready.";
}

export function stillOpenFor(hm: string, hours: HouseHours | null, at = new Date()) {
  return pickupSlots(hours, at).some((slot) => slot.hm === hm);
}

export function pickupHm(forAt?: string | null) {
  if (!forAt) return "";
  const at = new Date(forAt);
  if (Number.isNaN(at.getTime())) return "";
  const minutes = minutesInLondon(at);
  return padClock(Math.floor(minutes / 60)) + ":" + padClock(minutes % 60);
}

export type Line = {
  id: string;
  name: string;
  price_gbp: number;
  qty: number;
  rank: boolean;
};

export type LastCup = {
  id: string;
  name: string;
};

export const LAST_CUPS_MAX = 5;

export const BAG_QTY_MAX = 9;
export const BAG_LINES_MAX = 12;

export function findUsualItem(items: MenuItem[], id: string, name: string): MenuItem | undefined {
  const usualId = String(id || "").trim();
  const usualName = String(name || "").trim();
  if (usualId) {
    const byId = items.find((item) => String(item.id || item.name) === usualId);
    if (byId) return byId;
  }
  if (!usualName) return undefined;
  const needle = usualName.toLowerCase();
  return items.find((item) => String(item.name).trim().toLowerCase() === needle);
}

export function usualAwayLine(items: MenuItem[], id: string, name: string) {
  const called = String(name || "").trim() || "the usual";
  if (!id && !name) return "";
  if (!items.length) return "";
  const item = findUsualItem(items, id, name);
  if (!item) return called + " is not on the board today.";
  if (item.sold_out) return item.name + " is sold today.";
  return "";
}

export function usualHintLine(items: MenuItem[], id: string, name: string, note: string) {
  const usualName = String(name || "").trim();
  const usualNote = String(note || "").trim();
  if (!id && !usualName) return "Keep one from the bag";
  const away = usualAwayLine(items, id, name);
  if (away) return away;
  const item = findUsualItem(items, id, name);
  const called = (item && item.name) || usualName || "the usual";
  return usualNote ? called + " · " + usualNote : called;
}

function cupNameKey(name: string) {
  return String(name || "").trim().toLowerCase();
}

export function sameCup(
  a: { id?: string; name?: string } | null | undefined,
  b: { id?: string; name?: string } | null | undefined
) {
  if (!a || !b) return false;
  const aId = String(a.id || "").trim();
  const bId = String(b.id || "").trim();
  if (aId && bId && aId === bId) return true;
  const aName = cupNameKey(a.name || "");
  const bName = cupNameKey(b.name || "");
  return !!(aName && bName && aName === bName);
}

export function asLastCup(raw: { id?: string; name?: string } | null | undefined): LastCup | null {
  const name = String(raw?.name || "").trim().slice(0, 80);
  if (!name) return null;
  const id = String(raw?.id || name).trim().slice(0, 80);
  return { id: id || name, name };
}

function paidForCups(order: HouseOrder) {
  if (!order || order.status === "cancelled" || order.status === "hold") return false;
  return !!order.paid || order.status === "collected" || isLiveOrder(order.status);
}

export function lastCupsFromOrders(orders: HouseOrder[], limit = LAST_CUPS_MAX): LastCup[] {
  const seen: Record<string, true> = {};
  const out: LastCup[] = [];
  (orders || []).forEach((order) => {
    if (!paidForCups(order) || out.length >= limit) return;
    (order.items || []).forEach((row) => {
      if (out.length >= limit) return;
      const cup = asLastCup(row);
      if (!cup) return;
      const key = cupNameKey(cup.name);
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push(cup);
    });
  });
  return out;
}

export function lastCupAwayLine(items: MenuItem[], id: string, name: string) {
  if (!id && !name) return "";
  if (!items.length) return "";
  const item = findUsualItem(items, id, name);
  if (!item || item.sold_out) return "That’s not on today.";
  return "";
}

export function rememberLastCup(
  list: LastCup[],
  incoming: { id?: string; name?: string } | null | undefined,
  usualId = "",
  usualName = "",
  limit = LAST_CUPS_MAX
): LastCup[] {
  return mergeLastCups([asLastCup(incoming)].filter(Boolean) as LastCup[], list, usualId, usualName, limit);
}

export function mergeLastCups(
  fromOrders: LastCup[],
  local: LastCup[],
  usualId = "",
  usualName = "",
  limit = LAST_CUPS_MAX
): LastCup[] {
  const usual = asLastCup({ id: usualId, name: usualName });
  const out: LastCup[] = [];
  const seen: Record<string, true> = {};
  const push = (next: LastCup | null) => {
    if (!next) return;
    if (usual && sameCup(next, usual)) return;
    const key = cupNameKey(next.name);
    if (!key || seen[key] || out.length >= limit) return;
    seen[key] = true;
    out.push({ id: next.id, name: next.name });
  };
  (fromOrders || []).forEach((row) => push(asLastCup(row)));
  (local || []).forEach((row) => push(asLastCup(row)));
  return out;
}

export function lastCupsOnBoard(
  cups: LastCup[],
  items: MenuItem[],
  usualId = "",
  usualName = "",
  limit = LAST_CUPS_MAX
): LastCup[] {
  const usual = asLastCup({ id: usualId, name: usualName });
  const out: LastCup[] = [];
  (cups || []).forEach((row) => {
    if (out.length >= limit) return;
    const cup = asLastCup(row);
    if (!cup) return;
    if (usual && sameCup(cup, usual)) return;
    if (items.length) {
      const item = findUsualItem(items, cup.id, cup.name);
      if (!item || item.sold_out) return;
      out.push({ id: String(item.id || item.name), name: item.name });
      return;
    }
    out.push(cup);
  });
  return out;
}

export function cupsEqual(a: LastCup[], b: LastCup[]) {
  if (a.length !== b.length) return false;
  return a.every((cup, i) => sameCup(cup, b[i]));
}

export function bagQty(bag: Line[]) {
  return bag.reduce((sum, row) => sum + (Number(row.qty) || 0), 0);
}

export function bagTotal(bag: Line[]) {
  return bag.reduce((sum, row) => sum + (Number(row.price_gbp) || 0) * (Number(row.qty) || 0), 0);
}

export function orderItemsLine(order: HouseOrder) {
  return (order.items || [])
    .map((row) => row.qty + " × " + row.name)
    .join(" · ");
}

export function linesFromOrder(order: HouseOrder, items: MenuItem[], onRank: boolean): Line[] {
  const out: Line[] = [];
  (order.items || []).forEach((row) => {
    const found = items.find(
      (item) => String(item.name).trim().toLowerCase() === String(row.name).trim().toLowerCase()
    );
    if (!found || found.sold_out) return;
    const id = String(found.id || found.name);
    const qty = Math.min(BAG_QTY_MAX, Math.max(1, Number(row.qty) || 1));
    const existing = out.find((line) => line.id === id);
    if (existing) {
      existing.qty = Math.min(BAG_QTY_MAX, existing.qty + qty);
      return;
    }
    if (out.length >= BAG_LINES_MAX) return;
    out.push({
      id,
      name: found.name,
      price_gbp: priceOf(found, onRank),
      qty,
      rank: onRankPrice(found, onRank)
    });
  });
  return out;
}

export function recentForReorder(orders: HouseOrder[], limit = 4) {
  const seen: Record<string, true> = {};
  const out: HouseOrder[] = [];
  orders.forEach((order) => {
    if (order.status !== "collected") return;
    const key = (order.items || [])
      .map((row) => String(row.qty) + ":" + String(row.name).trim().toLowerCase())
      .sort()
      .join("|");
    if (!key || seen[key]) return;
    seen[key] = true;
    out.push(order);
  });
  return out.slice(0, limit);
}

export function historyOrders(orders: HouseOrder[]) {
  return orders.filter((order) => order.status === "collected");
}

export function shortOrderId(id: string) {
  return String(id || "")
    .replace(/-/g, "")
    .slice(0, 8);
}

export function orderWhen(order: { created_at?: string; for_at?: string | null }) {
  const raw = order.created_at || order.for_at;
  if (!raw) return "";
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(at);
}

export function receiptShare(order: HouseOrder) {
  const lines = (order.items || []).map((row) => {
    const qty = Number(row.qty) || 1;
    const price = formatPrice((Number(row.price_gbp) || 0) * qty);
    return qty + " × " + row.name + (price ? "  " + price : "");
  });
  return [
    "blanco.",
    "4 Fiveways Parade, Hazel Grove",
    orderWhen(order),
    "",
    ...lines,
    "",
    "total  " + formatPrice(order.total_gbp),
    order.paid ? "paid." : "",
    order.status === "collected" ? "collected." : "",
    shortOrderId(order.id)
  ]
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n")
    .trim();
}

export function liveOrders(orders: HouseOrder[]) {
  return orders.filter((order) => isLiveOrder(order.status));
}

export function watchingOrders(orders: HouseOrder[]) {
  return orders.filter((order) => isWatchingOrder(order.status));
}

export function isLiveOrder(status: string) {
  return status === "in" || status === "preparing" || status === "ready";
}

export function isWatchingOrder(status: string) {
  return status === "hold" || isLiveOrder(status);
}

export function canLetGo(order: { status: string; paid?: boolean }) {
  return (order.status === "hold" || order.status === "in") && !order.paid;
}

export const CUP_STEPS = [
  { id: "in", label: "in" },
  { id: "preparing", label: "making it" },
  { id: "ready", label: "ready" }
] as const;

export function collectionStepIndex(status: string) {
  if (status === "ready" || status === "collected") return 2;
  if (status === "preparing") return 1;
  if (status === "in") return 0;
  return -1;
}

export function collectionHeadline(order: HouseOrder) {
  if (order.status === "hold") return "waiting to pay.";
  if (order.status === "in") return "the house has it.";
  if (order.status === "preparing") return "the house is making it.";
  if (order.status === "ready") return "ready for you.";
  if (order.status === "collected") return "collected.";
  return "let go.";
}

export function bagHintLine(orders: HouseOrder[]) {
  const waiting = orders.find((order) => order.status === "hold");
  if (waiting) return "Waiting to pay";
  const live = liveOrders(orders)[0];
  if (live) return orderStatusLine(live);
  if (lastCupsFromOrders(orders, 1).length) return "A last cup from the bag";
  return "Start a collection";
}

export type HouseOrder = {
  id: string;
  status: string;
  items: Line[];
  note: string;
  for_at?: string | null;
  total_gbp: number;
  paid: boolean;
  pay_at: string;
  name?: string;
  email?: string;
  rank?: boolean;
  receipt_url?: string;
  created_at?: string;
};

export type Session = {
  token: string;
  sessionId: string;
  name: string;
  email: string;
};

export function formatPrice(value: number) {
  const n = Number(value);
  if (!isFinite(n)) return "";
  if (Math.round(n * 100) % 100 === 0) return "£" + String(Math.round(n));
  return "£" + n.toFixed(2);
}

export function priceOf(item: MenuItem, onRank: boolean) {
  const rank = Number(item.driver_price_gbp);
  if (
    onRank &&
    item.driver_price_gbp !== null &&
    item.driver_price_gbp !== undefined &&
    isFinite(rank) &&
    rank >= 0
  ) {
    return rank;
  }
  return Number(item.price_gbp) || 0;
}

export function onRankPrice(item: MenuItem, onRank: boolean) {
  return (
    onRank &&
    item.driver_price_gbp !== null &&
    item.driver_price_gbp !== undefined &&
    isFinite(Number(item.driver_price_gbp))
  );
}

export function groupBoard(items: MenuItem[], board: string): MenuSection[] {
  const sections: MenuSection[] = [];
  const map: Record<string, MenuSection> = {};
  items
    .filter((item) => item.board === board)
    .sort(
      (a, b) =>
        (a.sort || 0) - (b.sort || 0) || String(a.name).localeCompare(String(b.name))
    )
    .forEach((item) => {
      const title = item.section || "The board";
      if (!map[title]) {
        map[title] = { title, items: [] };
        sections.push(map[title]);
      }
      map[title].items.push(item);
    });
  return sections;
}

function sbHeaders() {
  return {
    apikey: SUPABASE_ANON,
    Authorization: "Bearer " + SUPABASE_ANON
  };
}

export async function fetchMenu(): Promise<MenuItem[]> {
  const res = await fetch(
    SUPABASE_URL + "/rest/v1/menu_items?select=*&order=sort.asc,name.asc",
    { headers: sbHeaders() }
  );
  if (!res.ok) throw new Error("The board could not load.");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchHours(): Promise<HouseHours | null> {
  const res = await fetch(
    SUPABASE_URL + "/rest/v1/house_settings?id=eq.1&select=*",
    { headers: sbHeaders() }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const row = (data && data[0]) || null;
  if (!row) return null;
  const hours: HouseHours = {
    hours_line: String(row.hours_line || ""),
    hours_days: String(row.hours_days || ""),
    hours_range: String(row.hours_range || ""),
    notice: String(row.notice || ""),
    how_busy: String(row.how_busy || ""),
    how_wait: String(row.how_wait || ""),
    pace_at: row.pace_at ? String(row.pace_at) : "",
    opens: row.opens ? String(row.opens) : undefined,
    closes: row.closes ? String(row.closes) : undefined
  };
  if (paceStale(hours)) {
    return { ...hours, how_busy: "", how_wait: "" };
  }
  return hours;
}

export type HouseReview = {
  author: string;
  relativeTime: string;
  text: string;
  rating: number;
};

export type HouseReviews = {
  rating: number;
  count: number;
  url: string;
  writeUrl: string;
  reviews: HouseReview[];
};

export async function fetchReviews(): Promise<HouseReviews | null> {
  try {
    const res = await fetch(HOUSE_SITE + "/api/reviews");
    if (!res.ok) return null;
    const data = await res.json();
    const reviews = Array.isArray(data.reviews) ? data.reviews : [];
    return {
      rating: Number(data.rating) || 0,
      count: Number(data.count) || 0,
      url: String(data.url || ""),
      writeUrl: String(data.writeUrl || ""),
      reviews: reviews
        .map((row: { author?: string; relativeTime?: string; text?: string; rating?: number }) => ({
          author: String(row.author || "Guest"),
          relativeTime: String(row.relativeTime || ""),
          text: String(row.text || "").trim(),
          rating: Number(row.rating) || 0
        }))
        .filter((row: HouseReview) => row.text)
        .slice(0, 3)
    };
  } catch {
    return null;
  }
}

function clerkHeaders(session: Session) {
  return {
    Authorization: "Bearer " + session.token,
    "X-Clerk-Session": session.sessionId,
    "Content-Type": "application/json"
  };
}

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("The board is not on the house yet.");
    }
    throw new Error((data && data.error) || "The house could not take that.");
  }
  return data;
}

export async function fetchPay(): Promise<{ stripe: boolean }> {
  const res = await fetch(HOUSE_SITE + "/api/pay");
  const data = await res.json().catch(() => ({}));
  return { stripe: !!data.stripe };
}

export async function fetchOrders(session: Session): Promise<{
  stripe: boolean;
  orders: HouseOrder[];
}> {
  const res = await fetch(HOUSE_SITE + "/api/orders", {
    headers: clerkHeaders(session)
  });
  const data = await readJson(res);
  const orders = Array.isArray(data.orders) ? data.orders : [];
  return {
    stripe: !!data.stripe,
    orders: orders.filter((row: HouseOrder) => row.status !== "cancelled")
  };
}

export async function fetchOrder(session: Session, id: string): Promise<HouseOrder | null> {
  const res = await fetch(
    HOUSE_SITE + "/api/orders?id=" + encodeURIComponent(id),
    { headers: clerkHeaders(session) }
  );
  const data = await readJson(res);
  const order = data.order as HouseOrder | undefined;
  if (!order || order.status === "cancelled") return null;
  return order;
}

export async function placeOrder(
  session: Session,
  items: Line[],
  note: string,
  returnUrl?: string,
  forAt?: string | null
) {
  const res = await fetch(HOUSE_SITE + "/api/orders", {
    method: "POST",
    headers: clerkHeaders(session),
    body: JSON.stringify({
      items,
      note,
      pay: "stripe",
      return_url: returnUrl || "",
      for: forAt || ""
    })
  });
  return readJson(res);
}

export async function cancelOrder(session: Session, id: string) {
  const res = await fetch(HOUSE_SITE + "/api/orders", {
    method: "PATCH",
    headers: clerkHeaders(session),
    body: JSON.stringify({ id, status: "cancelled" })
  });
  return readJson(res);
}

export async function fetchDeskOrders(session: Session): Promise<HouseOrder[]> {
  const res = await fetch(HOUSE_SITE + "/api/orders?desk=1", {
    headers: clerkHeaders(session)
  });
  const data = await readJson(res);
  const orders = Array.isArray(data.orders) ? data.orders : [];
  return orders.filter((row: HouseOrder) => row.status !== "cancelled");
}

export async function setDeskOrder(session: Session, id: string, status: string) {
  const res = await fetch(HOUSE_SITE + "/api/orders", {
    method: "PATCH",
    headers: clerkHeaders(session),
    body: JSON.stringify({ id, status })
  });
  return readJson(res);
}

export type DeskCup = CupCheckin & { status: "live" | "hold" };

export async function fetchDeskCups(session: Session): Promise<{
  holds: DeskCup[];
  cups: DeskCup[];
}> {
  const res = await fetch(HOUSE_SITE + "/api/checkins?desk=1", {
    headers: clerkHeaders(session)
  });
  const data = await readJson(res);
  function list(raw: unknown): DeskCup[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((row: Partial<CupCheckin>) => asCup(row))
      .filter((row): row is CupCheckin => !!row)
      .map((row) => ({ ...row, status: row.status === "hold" ? "hold" : ("live" as const) }));
  }
  return {
    holds: list(data.holds),
    cups: list(data.cups)
  };
}

export async function setDeskCup(session: Session, id: string, status: "live" | "drop") {
  const res = await fetch(HOUSE_SITE + "/api/checkins", {
    method: "PATCH",
    headers: clerkHeaders(session),
    body: JSON.stringify({ id, status })
  });
  return readJson(res);
}

export type DeskCard = {
  stamps: number;
  cards_done: number;
  email: string;
  name: string;
  filled?: boolean;
};

export async function findDeskCard(session: Session, email: string): Promise<DeskCard> {
  const res = await fetch(HOUSE_SITE + "/api/stamps?email=" + encodeURIComponent(email), {
    headers: clerkHeaders(session)
  });
  const data = await readJson(res);
  return {
    stamps: Number(data.stamps) || 0,
    cards_done: Number(data.cards_done) || 0,
    email: String(data.email || email),
    name: String(data.name || "")
  };
}

export type StampShow = {
  url: string;
  expires_at: string;
  ttl_sec: number;
  svg: string;
  png: string;
};

export async function mintDeskStamp(session: Session): Promise<StampShow> {
  const res = await fetch(HOUSE_SITE + "/api/stamps", {
    method: "POST",
    headers: clerkHeaders(session),
    body: JSON.stringify({ action: "mint" })
  });
  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    const fromApi = data && typeof data === "object" ? String((data as { error?: string }).error || "") : "";
    throw new Error(fromApi || "the code could not open.");
  }
  return {
    url: String((data as { url?: string }).url || ""),
    expires_at: String((data as { expires_at?: string }).expires_at || ""),
    ttl_sec: Number((data as { ttl_sec?: number }).ttl_sec) || 60,
    svg: String((data as { svg?: string }).svg || ""),
    png: String((data as { png?: string }).png || "")
  };
}

export function stampTokenFromHref(href: string) {
  const raw = String(href || "").trim();
  if (!raw) return "";
  if (/^[A-Za-z0-9_-]{20,48}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    const token = (url.searchParams.get("t") || "").trim();
    if (!token) return "";
    const host = String(url.hostname || url.host || "").toLowerCase();
    const path = String(url.pathname || "").toLowerCase();
    const protocol = String(url.protocol || "").toLowerCase();
    if (protocol === "blanco:" && (host === "stamp" || path.indexOf("stamp") !== -1)) {
      return token;
    }
    if (path.indexOf("stamp") === -1) return "";
    if (
      host === "blancocoffeehouse.com" ||
      host === "www.blancocoffeehouse.com" ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host.endsWith(".local") ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
    ) {
      return token;
    }
    return "";
  } catch {
    return "";
  }
}

export async function redeemStamp(
  session: Session,
  token: string
): Promise<DeskCard> {
  const res = await fetch(HOUSE_SITE + "/api/stamps", {
    method: "POST",
    headers: clerkHeaders(session),
    body: JSON.stringify({ token })
  });
  const data = await readJson(res);
  return {
    stamps: Number(data.stamps) || 0,
    cards_done: Number(data.cards_done) || 0,
    email: String(data.email || ""),
    name: String(data.name || ""),
    filled: !!data.filled
  };
}

export async function giveDeskStamp(session: Session, email: string): Promise<DeskCard> {
  const res = await fetch(HOUSE_SITE + "/api/stamps", {
    method: "POST",
    headers: clerkHeaders(session),
    body: JSON.stringify({ email })
  });
  const data = await readJson(res);
  return {
    stamps: Number(data.stamps) || 0,
    cards_done: Number(data.cards_done) || 0,
    email: String(data.email || email),
    name: String(data.name || ""),
    filled: !!data.filled
  };
}

export type DeskDriver = {
  id: string;
  email: string;
  name: string;
  status: string;
};

export async function fetchDeskRank(session: Session): Promise<{
  code: string;
  count: number;
  drivers: DeskDriver[];
}> {
  const res = await fetch(HOUSE_SITE + "/api/drivers?desk=1", {
    headers: clerkHeaders(session)
  });
  const data = await readJson(res);
  const drivers = Array.isArray(data.drivers) ? data.drivers : [];
  return {
    code: String(data.code || "RANK-····"),
    count: Number(data.count) || 0,
    drivers: drivers.map((row: DeskDriver) => ({
      id: String(row.id || ""),
      email: String(row.email || ""),
      name: String(row.name || ""),
      status: String(row.status || "")
    }))
  };
}

export async function postDeskRank(
  session: Session,
  patch: { action: "rotate" | "add" | "pause" | "in"; email?: string }
) {
  const res = await fetch(HOUSE_SITE + "/api/drivers", {
    method: "POST",
    headers: clerkHeaders(session),
    body: JSON.stringify(patch)
  });
  return readJson(res);
}

export type DeskItem = {
  id: string;
  board: string;
  section: string;
  name: string;
  description: string;
  price_gbp: number;
  driver_price_gbp: number | null;
  sold_out: boolean;
  sort: number;
  photo: string;
  allergens: string[];
};

export type DeskHours = {
  hours_line: string;
  hours_days: string;
  hours_range: string;
  opens: string;
  closes: string;
  notice: string;
};

function asDeskItem(row: Record<string, unknown>): DeskItem | null {
  const name = String(row.name || "").trim();
  if (!name) return null;
  const allergens = Array.isArray(row.allergens)
    ? HOUSE_TAGS.filter((tag) => (row.allergens as string[]).indexOf(tag) !== -1)
    : [];
  const rank = Number(row.driver_price_gbp);
  return {
    id: String(row.id || ""),
    board: row.board === "sweets" ? "sweets" : "drinks",
    section: String(row.section || "The board").trim() || "The board",
    name,
    description: String(row.description || ""),
    price_gbp: Number(row.price_gbp) || 0,
    driver_price_gbp: isFinite(rank) ? rank : null,
    sold_out: !!row.sold_out,
    sort: parseInt(String(row.sort || "0"), 10) || 0,
    photo: String(row.photo || ""),
    allergens
  };
}

export async function fetchDeskBoard(session: Session): Promise<{
  settings: DeskHours;
  items: DeskItem[];
}> {
  const res = await fetch(HOUSE_SITE + "/api/admin", {
    headers: clerkHeaders(session)
  });
  const data = await readJson(res);
  const settings = data.settings || {};
  const items = Array.isArray(data.items) ? data.items : [];
  return {
    settings: {
      hours_line: String(settings.hours_line || "Open every day · 11am–8pm"),
      hours_days: String(settings.hours_days || "Monday–Sunday"),
      hours_range: String(settings.hours_range || "11am–8pm"),
      opens: String(settings.opens || "11:00"),
      closes: String(settings.closes || "20:00"),
      notice: String(settings.notice || "")
    },
    items: items.map((row: Record<string, unknown>) => asDeskItem(row)).filter(Boolean) as DeskItem[]
  };
}

export async function saveDeskBoard(
  session: Session,
  patch: { settings?: DeskHours; items?: DeskItem[]; deleted_ids?: string[] }
) {
  const res = await fetch(HOUSE_SITE + "/api/admin", {
    method: "PUT",
    headers: clerkHeaders(session),
    body: JSON.stringify(patch)
  });
  return readJson(res);
}

export async function postDeskShot(
  session: Session,
  image: string,
  kind: "house" | "cup" | "sweets",
  caption: string
) {
  const res = await fetch(HOUSE_SITE + "/api/gallery", {
    method: "POST",
    headers: clerkHeaders(session),
    body: JSON.stringify({
      image,
      kind,
      caption,
      alt: caption || "From the house."
    })
  });
  return readJson(res);
}

export async function fetchStamps(session: Session): Promise<{
  stamps: number;
  cards_done: number;
}> {
  const res = await fetch(HOUSE_SITE + "/api/stamps", {
    headers: clerkHeaders(session)
  });
  const data = await readJson(res);
  return {
    stamps: Number(data.stamps) || 0,
    cards_done: Number(data.cards_done) || 0
  };
}

export async function fetchRank(session: Session): Promise<{
  driver: boolean;
  paused: boolean;
}> {
  const res = await fetch(HOUSE_SITE + "/api/drivers", {
    headers: clerkHeaders(session)
  });
  const data = await readJson(res);
  return {
    driver: !!data.driver,
    paused: !!data.paused
  };
}

export type CupCheckin = {
  id: string;
  uri: string;
  name: string;
  day: string;
  mine: boolean;
  status?: "live" | "hold";
  created_at: string;
};

export type CupBoard = {
  today: string;
  mine: CupCheckin | null;
  cups: CupCheckin[];
  waiting?: boolean;
};

function asCup(row: Partial<CupCheckin> | null | undefined): CupCheckin | null {
  if (!row || !row.id || !row.uri) return null;
  return {
    id: String(row.id),
    uri: String(row.uri),
    name: String(row.name || "a member"),
    day: String(row.day || ""),
    mine: !!row.mine,
    status: row.status === "hold" ? "hold" : "live",
    created_at: String(row.created_at || "")
  };
}

export async function fetchCheckins(session: Session): Promise<CupBoard> {
  const res = await fetch(HOUSE_SITE + "/api/checkins", {
    headers: clerkHeaders(session)
  });
  const data = await readJson(res);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const cups = (Array.isArray(data.cups) ? data.cups : [])
    .map((row: Partial<CupCheckin>) => asCup(row))
    .filter((row): row is CupCheckin => !!row && row.status !== "hold" && Date.parse(row.created_at) >= cutoff);
  const mine = asCup(data.mine) || cups.find((cup) => cup.mine) || null;
  return {
    today: String(data.today || ""),
    mine,
    cups,
    waiting: !!data.waiting || mine?.status === "hold"
  };
}

export async function postCheckin(session: Session, image: string) {
  const res = await fetch(HOUSE_SITE + "/api/checkins", {
    method: "POST",
    headers: clerkHeaders(session),
    body: JSON.stringify({ image })
  });
  const data = await readJson(res);
  return asCup(data.cup);
}

export async function dropCheckin(session: Session, id: string) {
  const res = await fetch(HOUSE_SITE + "/api/checkins", {
    method: "DELETE",
    headers: clerkHeaders(session),
    body: JSON.stringify({ id })
  });
  return readJson(res);
}

export type HouseHandle = {
  handle: string;
  suggestions: string[];
};

export async function fetchHandle(session: Session): Promise<HouseHandle> {
  const res = await fetch(HOUSE_SITE + "/api/handle", {
    headers: clerkHeaders(session)
  });
  const data = await readJson(res);
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
  return {
    handle: String(data.handle || ""),
    suggestions: suggestions.map((row: string) => String(row || "")).filter(Boolean)
  };
}

export async function pickHandle(session: Session, handle: string) {
  const res = await fetch(HOUSE_SITE + "/api/handle", {
    method: "POST",
    headers: clerkHeaders(session),
    body: JSON.stringify({ handle })
  });
  const data = await readJson(res);
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
  return {
    handle: String(data.handle || handle),
    suggestions: suggestions.map((row: string) => String(row || "")).filter(Boolean)
  };
}

export async function moreHandles(session: Session) {
  const res = await fetch(HOUSE_SITE + "/api/handle", {
    method: "POST",
    headers: clerkHeaders(session),
    body: JSON.stringify({ more: true })
  });
  const data = await readJson(res);
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
  return {
    handle: String(data.handle || ""),
    suggestions: suggestions.map((row: string) => String(row || "")).filter(Boolean)
  };
}

export async function fetchPace(session: Session): Promise<{
  how_busy: string;
  how_wait: string;
  pace_at: string;
  admin: boolean;
  stale: boolean;
}> {
  const res = await fetch(HOUSE_SITE + "/api/pace", {
    headers: clerkHeaders(session)
  });
  const data = await readJson(res);
  return {
    how_busy: String(data.how_busy || ""),
    how_wait: String(data.how_wait || ""),
    pace_at: String(data.pace_at || ""),
    admin: !!data.admin,
    stale: !!data.stale
  };
}

export async function postPace(
  session: Session,
  patch: { how_busy?: string; how_wait?: string }
) {
  const res = await fetch(HOUSE_SITE + "/api/pace", {
    method: "POST",
    headers: clerkHeaders(session),
    body: JSON.stringify(patch)
  });
  return readJson(res);
}

export async function joinRank(session: Session, code: string) {
  const res = await fetch(HOUSE_SITE + "/api/drivers", {
    method: "POST",
    headers: clerkHeaders(session),
    body: JSON.stringify({ action: "join", code })
  });
  return readJson(res);
}

export function orderStatusLine(order: HouseOrder) {
  const when = pickupWhen(order);
  const tail = when ? " · " + when : "";
  if (order.status === "hold") return "Waiting to pay" + tail;
  if (order.status === "in") return (order.paid ? "Paid · in" : "In") + tail;
  if (order.status === "preparing") return (order.paid ? "Paid · making it" : "Making it") + tail;
  if (order.status === "ready") return (order.paid ? "Paid · ready for you" : "Ready for you") + tail;
  if (order.status === "collected") return "Collected" + tail;
  return "Let go";
}
