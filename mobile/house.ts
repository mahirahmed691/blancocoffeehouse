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
};

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

export type Line = {
  id: string;
  name: string;
  price_gbp: number;
  qty: number;
  rank: boolean;
};

export const BAG_QTY_MAX = 9;
export const BAG_LINES_MAX = 12;

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

export function liveOrders(orders: HouseOrder[]) {
  return orders.filter((order) => order.status === "in" || order.status === "ready");
}

export function bagHintLine(orders: HouseOrder[]) {
  const waiting = orders.find((order) => order.status === "hold");
  if (waiting) return "Waiting to pay";
  const live = liveOrders(orders)[0];
  if (live) return orderStatusLine(live);
  if (recentForReorder(orders, 1).length) return "Order again from the bag";
  return "Start a collection";
}

export type HouseOrder = {
  id: string;
  status: string;
  items: Line[];
  note: string;
  total_gbp: number;
  paid: boolean;
  pay_at: string;
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

export async function placeOrder(
  session: Session,
  items: Line[],
  note: string,
  pay: "stripe" | "counter",
  returnUrl?: string
) {
  const res = await fetch(HOUSE_SITE + "/api/orders", {
    method: "POST",
    headers: clerkHeaders(session),
    body: JSON.stringify({ items, note, pay, return_url: returnUrl || "" })
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
  created_at: string;
};

export type CupBoard = {
  today: string;
  mine: CupCheckin | null;
  cups: CupCheckin[];
};

function asCup(row: Partial<CupCheckin> | null | undefined): CupCheckin | null {
  if (!row || !row.id || !row.uri) return null;
  return {
    id: String(row.id),
    uri: String(row.uri),
    name: String(row.name || "a member"),
    day: String(row.day || ""),
    mine: !!row.mine,
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
    .filter((row): row is CupCheckin => !!row && Date.parse(row.created_at) >= cutoff);
  return {
    today: String(data.today || ""),
    mine: cups.find((cup) => cup.mine) || null,
    cups
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
  if (order.status === "hold") return "Waiting to pay";
  if (order.status === "in") return order.paid ? "Paid · at the counter" : "At the counter";
  if (order.status === "ready") return order.paid ? "Paid · ready for you" : "Ready for you";
  if (order.status === "collected") return "Collected";
  return "Let go";
}
