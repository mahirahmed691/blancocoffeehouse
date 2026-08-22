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
  opens?: string;
  closes?: string;
};

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
    if (order.status === "hold") return;
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
  return (data && data[0]) || null;
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
