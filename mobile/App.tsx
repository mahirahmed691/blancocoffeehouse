import {
  Fraunces_500Medium_Italic,
  Fraunces_600SemiBold,
  useFonts
} from "@expo-google-fonts/fraunces";
import { Nunito_700Bold, Nunito_800ExtraBold } from "@expo-google-fonts/nunito";
import {
  WorkSans_400Regular,
  WorkSans_500Medium,
  WorkSans_600SemiBold
} from "@expo-google-fonts/work-sans";
import { ClerkProvider, useAuth, useUser } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Gate } from "./auth";
import { ok, tap, warn } from "./feel";
import {
  bagQty,
  bagTotal,
  BAG_LINES_MAX,
  BAG_QTY_MAX,
  fetchHandle,
  fetchHours,
  fetchMenu,
  fetchOrders,
  fetchPay,
  fetchPace,
  fetchRank,
  fetchStamps,
  formatPrice,
  groupBoard,
  houseBusyLine,
  houseOpenLine,
  houseState,
  counterCue,
  joinRank,
  cancelOrder,
  collectionHeadline,
  collectionStepIndex,
  CUP_STEPS,
  linesFromOrder,
  liveOrders,
  watchingOrders,
  canLetGo,
  isLiveOrder,
  isWatchingOrder,
  moreHandles,
  onRankPrice,
  orderItemsLine,
  orderStatusLine,
  pickHandle,
  placeOrder,
  postPace,
  priceOf,
  recentForReorder,
  bagHintLine,
  type HouseHours,
  type HouseOrder,
  type Line,
  type MenuItem,
  type Session
} from "./house";
import { type Piece } from "./pieces";
import { DEFAULT_PREFS, loadPrefs, type PayPref, type Prefs } from "./prefs";
import { LookScreen } from "./look";
import { type LookBoard } from "./shots";
import {
  BEIGE,
  BROWN,
  LINE,
  MUTED,
  PAPER,
  ROUND,
  ROUND_BOLD,
  SANS,
  SANS_MED,
  SANS_SEMI,
  SERIF,
  SERIF_ITALIC,
  usePad
} from "./theme";
import { Back, Kicker, Mark, Stick } from "./ui";
import { YouStack, type YouPage } from "./you";
import { Pop, Rise } from "./motion";

type Tab = "menu" | "look" | "bag" | "you";
type Board = "drinks" | "sweets";

function payHrefKind(url: string) {
  const href = String(url || "").toLowerCase();
  if (href.indexOf("paid=1") !== -1) return "paid";
  if (href.indexOf("cancel=1") !== -1) return "cancel";
  return "";
}

function Grain() {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={[styles.grain, { width, height }]}>
      <Image
        source={require("./assets/grain.png")}
        style={{ width, height }}
        resizeMode="repeat"
      />
    </View>
  );
}

function MenuScreen({
  items,
  hours,
  onRank,
  loading,
  error,
  held,
  onRefresh,
  onAdd,
  onQty,
  onHouse
}: {
  items: MenuItem[];
  hours: HouseHours | null;
  onRank: boolean;
  loading: boolean;
  error: string;
  held: Line[];
  onRefresh: () => void;
  onAdd: (item: MenuItem) => void;
  onQty: (id: string, delta: number) => void;
  onHouse: () => void;
}) {
  const pad = usePad();
  const [board, setBoard] = useState<Board>("drinks");
  const sections = groupBoard(items, board);

  return (
    <View style={styles.screen}>
      <View style={[styles.sticky, { paddingTop: pad.top }]}>
        <Kicker label="the board" />
        <Text style={styles.title}>your way.</Text>
        <Pressable
          onPress={() => {
            tap();
            onHouse();
          }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="The house hours"
        >
          <Text style={styles.hours}>{houseOpenLine(hours)}</Text>
        </Pressable>
        {houseBusyLine(hours) ? <Text style={styles.notice}>{houseBusyLine(hours)}</Text> : null}
        {hours?.notice ? <Text style={styles.notice}>{hours.notice}</Text> : null}
        <Stick
          value={board}
          options={["drinks", "sweets"] as const}
          onChange={setBoard}
        />
      </View>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenInner, { paddingTop: 12, paddingBottom: 28 }]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={BROWN} />
        }
      >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && !sections.length && !error ? (
        <Text style={styles.prose}>The board is coming up.</Text>
      ) : null}
      {!loading && !error && !sections.length ? (
        <Text style={styles.prose}>The board is quiet. Pull to try again.</Text>
      ) : null}
      <Rise key={board} shift={false}>
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.items.map((item) => {
            const sold = !!item.sold_out;
            const rank = onRankPrice(item, onRank);
            const id = String(item.id || item.name);
            const heldQty = held.find((row) => row.id === id)?.qty || 0;
            return (
              <View key={id} style={[styles.item, sold && styles.rowSold]}>
                <View style={styles.itemTop}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <View style={styles.leader} />
                  <Text style={styles.rowPrice}>{formatPrice(priceOf(item, onRank))}</Text>
                  {sold ? (
                    <Text style={styles.soldMark}>sold</Text>
                  ) : heldQty > 0 ? (
                    <View style={styles.qty}>
                      <Pressable
                        onPress={() => onQty(id, -1)}
                        style={styles.qtyBtn}
                        accessibilityRole="button"
                        accessibilityLabel={"Fewer " + item.name}
                      >
                        <Text style={styles.qtyMark}>−</Text>
                      </Pressable>
                      <Text style={styles.qtyCount}>{heldQty}</Text>
                      <Pressable
                        onPress={() => onAdd(item)}
                        style={styles.qtyBtn}
                        accessibilityRole="button"
                        accessibilityLabel={"More " + item.name}
                      >
                        <Text style={styles.qtyMark}>+</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => onAdd(item)}
                      style={({ pressed }) => [styles.add, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={"Add " + item.name}
                    >
                      <Text style={styles.addText}>add</Text>
                    </Pressable>
                  )}
                </View>
                {item.description ? (
                  <Text style={styles.rowDesc}>{item.description}</Text>
                ) : null}
                {rank ? <Text style={styles.rankMark}>rank</Text> : null}
              </View>
            );
          })}
        </View>
      ))}
      </Rise>
    </ScrollView>
    </View>
  );
}

function CupTrack({
  order,
  onCancel
}: {
  order: HouseOrder;
  onCancel?: () => void;
}) {
  const idx = collectionStepIndex(order.status);
  return (
    <View style={[styles.cupTrack, order.status === "ready" && styles.cupTrackReady]}>
      <Text style={styles.cupNow}>{collectionHeadline(order)}</Text>
      {idx >= 0 ? (
        <>
          <View style={styles.cupRail} accessibilityLabel={collectionHeadline(order)}>
            {CUP_STEPS.map((step, i) => (
              <Fragment key={step.id}>
                {i > 0 ? (
                  <View style={[styles.cupLink, idx >= i && styles.cupLinkOn]} />
                ) : null}
                <View
                  style={[
                    styles.cupDot,
                    i < idx && styles.cupDotDone,
                    i === idx && styles.cupDotNow
                  ]}
                />
              </Fragment>
            ))}
          </View>
          <View style={styles.cupLabels}>
            {CUP_STEPS.map((step, i) => (
              <Text
                key={step.id}
                style={[styles.cupStep, (i === idx || i < idx) && styles.cupStepOn]}
              >
                {step.label}
              </Text>
            ))}
          </View>
        </>
      ) : null}
      <Text style={styles.pastItems}>{orderItemsLine(order)}</Text>
      <Text style={styles.pastPrice}>{formatPrice(Number(order.total_gbp) || 0)}</Text>
      {order.note ? <Text style={styles.pastNote}>“{order.note}”</Text> : null}
      <Text style={styles.pastNote}>
        {order.paid ? "Paid." : "Pay when you collect."} Collection at the counter — not to the door.
      </Text>
      {onCancel ? (
        <Pressable
          onPress={onCancel}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Let this collection go"
        >
          <Text style={styles.link}>Let this go</Text>
        </Pressable>
      ) : (
        <Text style={styles.pastNote}>Ask the counter if this should come off.</Text>
      )}
    </View>
  );
}

function BagScreen({
  bag,
  note,
  stripe,
  prefer,
  status,
  busy,
  items,
  hours,
  onRank,
  orders,
  refreshing,
  onNote,
  onQty,
  onClear,
  onPay,
  onMenu,
  onReorder,
  onCancelOrder,
  onRefresh
}: {
  bag: Line[];
  note: string;
  stripe: boolean;
  prefer: PayPref;
  status: string;
  busy: boolean;
  items: MenuItem[];
  hours: HouseHours | null;
  onRank: boolean;
  orders: HouseOrder[];
  refreshing: boolean;
  onNote: (next: string) => void;
  onQty: (id: string, delta: number) => void;
  onClear: () => void;
  onPay: (pay: "stripe" | "counter") => void;
  onMenu: () => void;
  onReorder: (order: HouseOrder) => void;
  onCancelOrder: (id: string) => void;
  onRefresh: () => void;
}) {
  const pad = usePad();
  const empty = bag.length === 0;
  const total = formatPrice(bagTotal(bag));
  const cardFirst = stripe && prefer !== "counter";
  const closed = houseState(hours) === "closed";
  const live = liveOrders(orders);
  const watching = watchingOrders(orders);
  const recent = recentForReorder(orders).filter(
    (order) => linesFromOrder(order, items, onRank).length > 0
  );

  function letGo(order: HouseOrder) {
    Alert.alert(
      "let this go?",
      "It comes off the counter. The bag is still here if you want another.",
      [
        { text: "stay", style: "cancel" },
        {
          text: "let go",
          style: "destructive",
          onPress: () => onCancelOrder(order.id)
        }
      ]
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenInner, { paddingTop: pad.top, paddingBottom: empty ? 36 : 24 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BROWN} />
        }
      >
        <Kicker label="collection" />
        <Text style={styles.title}>the bag.</Text>
        {houseBusyLine(hours) ? <Text style={styles.notice}>{houseBusyLine(hours)}</Text> : null}
        {!closed && counterCue(orders) ? (
          <Text style={styles.notice}>{counterCue(orders)}</Text>
        ) : null}
        {watching.map((order) => (
          <CupTrack
            key={order.id}
            order={order}
            onCancel={canLetGo(order) ? () => letGo(order) : undefined}
          />
        ))}
        {empty ? (
          <>
            <Text style={styles.prose}>
              {live.length
                ? "Watch this one. The house moves it from in, to making it, to ready."
                : stripe
                  ? "Add from the board. Pay now with the card, or at the counter when you collect."
                  : "Add from the board. Pay at the counter when you collect."}
            </Text>
            {status ? <Text style={styles.status}>{status}</Text> : null}
            <Pressable
              onPress={() => {
                tap();
                onMenu();
              }}
              style={({ pressed }) => [styles.btn, { marginTop: 22 }, pressed && styles.pressed]}
            >
              <Mark name="menu" size={18} color={BEIGE} />
              <Text style={styles.btnText}>The board</Text>
            </Pressable>
            {recent.length ? (
              <>
                <Text style={styles.sectionTitle}>again.</Text>
                {recent.map((order) => {
                  const lines = linesFromOrder(order, items, onRank);
                  const wanted = (order.items || []).reduce(
                    (sum, row) => sum + (Number(row.qty) || 0),
                    0
                  );
                  const skipped = bagQty(lines) < wanted;
                  return (
                    <Pressable
                      key={order.id}
                      onPress={() => onReorder(order)}
                      style={({ pressed }) => [styles.past, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={"Order again: " + orderItemsLine(order)}
                    >
                      <Text style={styles.pastItems}>{orderItemsLine(order)}</Text>
                      <Text style={styles.pastPrice}>{formatPrice(bagTotal(lines))}</Text>
                      <Text style={styles.link}>
                        {skipped ? "Order what is still on the board" : "Order again"}
                      </Text>
                    </Pressable>
                  );
                })}
              </>
            ) : null}
          </>
        ) : (
          <>
            {bag.map((row, index) => (
              <View key={row.id || row.name + "-" + index} style={styles.bagLine} collapsable={false}>
                <View style={styles.bagCopy}>
                  <Text style={styles.rowName}>{row.name}</Text>
                  {row.rank ? <Text style={styles.rankMark}>rank</Text> : null}
                </View>
                <View style={styles.qty} collapsable={false}>
                  <Pressable
                    onPress={() => onQty(row.id, -1)}
                    style={styles.qtyBtn}
                    accessibilityRole="button"
                    accessibilityLabel={"Fewer " + row.name}
                  >
                    <Text style={styles.qtyMark}>−</Text>
                  </Pressable>
                  <Text style={styles.qtyCount}>{row.qty}</Text>
                  <Pressable
                    onPress={() => onQty(row.id, 1)}
                    style={styles.qtyBtn}
                    accessibilityRole="button"
                    accessibilityLabel={"More " + row.name}
                  >
                    <Text style={styles.qtyMark}>+</Text>
                  </Pressable>
                </View>
                <Text style={styles.bagLinePrice}>
                  {formatPrice(row.price_gbp * row.qty)}
                </Text>
              </View>
            ))}
            <Pressable
              onPress={() => {
                tap();
                onClear();
              }}
              hitSlop={8}
            >
              <Text style={styles.link}>Let the bag go</Text>
            </Pressable>
            <Text style={styles.label}>A note for the counter</Text>
            <TextInput
              value={note}
              onChangeText={onNote}
              placeholder="No oat, extra hot…"
              placeholderTextColor="rgba(80,57,49,0.4)"
              style={styles.input}
              maxLength={140}
            />
          </>
        )}
      </ScrollView>
      {!empty ? (
        <View style={styles.bagDock}>
          <View style={styles.bagTotal}>
            <Text style={styles.bagTotalLabel}>the total.</Text>
            <Text style={styles.bagTotalSum}>{total}</Text>
          </View>
          {status ? <Text style={styles.status}>{status}</Text> : null}
          {closed ? (
            <Text style={styles.payHint}>
              The house is closed now. We’ll have it at the counter when we open.
            </Text>
          ) : null}
          {stripe ? (
            <Text style={styles.payHint}>
              The card opens in Safari, then brings you back here.
            </Text>
          ) : (
            <Text style={styles.payHint}>
              The card is not open on this phone yet. Pay at the counter.
            </Text>
          )}
          {stripe && cardFirst ? (
            <>
              <Pressable
                disabled={busy}
                onPress={() => onPay("stripe")}
                style={({ pressed }) => [styles.btn, { marginTop: 8 }, pressed && styles.pressed, busy && styles.dim]}
              >
                <Mark name="card" size={18} color={BEIGE} />
                <Text style={styles.btnText}>{busy ? "Opening the card…" : "Pay now · " + total}</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={() => onPay("counter")}
                style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed, busy && styles.dim]}
              >
                <Mark name="counter" size={18} />
                <Text style={styles.btnGhostText}>Pay at the counter</Text>
              </Pressable>
            </>
          ) : stripe ? (
            <>
              <Pressable
                disabled={busy}
                onPress={() => onPay("counter")}
                style={({ pressed }) => [styles.btn, { marginTop: 8 }, pressed && styles.pressed, busy && styles.dim]}
              >
                <Mark name="counter" size={18} color={BEIGE} />
                <Text style={styles.btnText}>
                  {busy ? "Sending to the counter…" : "Pay at the counter · " + total}
                </Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={() => onPay("stripe")}
                style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed, busy && styles.dim]}
              >
                <Mark name="card" size={18} />
                <Text style={styles.btnGhostText}>Pay now with the card</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              disabled={busy}
              onPress={() => onPay("counter")}
              style={({ pressed }) => [styles.btn, { marginTop: 8 }, pressed && styles.pressed, busy && styles.dim]}
            >
              <Mark name="bag" size={18} color={BEIGE} />
              <Text style={styles.btnText}>
                {busy ? "Sending to the counter…" : "Place for collection · " + total}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function Tabs({
  tab,
  bagCount,
  onTab
}: {
  tab: Tab;
  bagCount: number;
  onTab: (next: Tab) => void;
}) {
  const pad = usePad();
  return (
    <View style={[styles.tabs, { paddingBottom: pad.bottom }]}>
      {(
        [
          ["menu", "menu"],
          ["look", "look"],
          ["bag", "bag"],
          ["you", "you"]
        ] as const
      ).map(([id, label]) => {
        const on = tab === id;
        return (
          <Pressable
            key={id}
            onPress={() => {
              tap();
              onTab(id);
            }}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={label}
          >
            <View>
              <Pop on={on}>
                <Mark name={id} on={on} size={22} color={on ? BROWN : MUTED} />
              </Pop>
              {id === "bag" && bagCount ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{bagCount > 9 ? "9+" : String(bagCount)}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function App() {
  if (!publishableKey) {
    throw new Error("Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to mobile/.env");
  }
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <SafeAreaProvider>
        <AppFonts />
      </SafeAreaProvider>
    </ClerkProvider>
  );
}

function AppFonts() {
  const [loaded] = useFonts({
    Nunito_800ExtraBold,
    Nunito_700Bold,
    Fraunces_600SemiBold,
    Fraunces_500Medium_Italic,
    WorkSans_400Regular,
    WorkSans_500Medium,
    WorkSans_600SemiBold
  });
  if (!loaded) {
    return (
      <View style={styles.bootFull}>
        <Image source={require("./assets/mark.png")} style={styles.gateMark} />
        <Text style={styles.bootWord}>blanco.</Text>
        <Text style={styles.tag}>your way.</Text>
      </View>
    );
  }
  return <House />;
}

function House() {
  const { isLoaded, isSignedIn, getToken, sessionId, signOut } = useAuth();
  const { user } = useUser();
  const pad = usePad();
  const wasIn = useRef(false);

  const [tab, setTab] = useState<Tab>("menu");
  const [youPage, setYouPage] = useState<YouPage>("home");
  const [lookBoard, setLookBoard] = useState<LookBoard>("pictures");
  const [piece, setPiece] = useState<Piece | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [hours, setHours] = useState<HouseHours | null>(null);
  const [menuError, setMenuError] = useState("");
  const [menuLoading, setMenuLoading] = useState(false);
  const [onRank, setOnRank] = useState(false);
  const [desk, setDesk] = useState(false);
  const [handle, setHandle] = useState("");
  const [handlePicks, setHandlePicks] = useState<string[]>([]);
  const [bag, setBag] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [stripe, setStripe] = useState(false);
  const [bagStatus, setBagStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [stamps, setStamps] = useState(0);
  const [cardsDone, setCardsDone] = useState(0);
  const [orders, setOrders] = useState<HouseOrder[]>([]);
  const [rankCode, setRankCode] = useState("");
  const [rankNote, setRankNote] = useState("");
  const [toast, setToast] = useState("");
  const pendingPayId = useRef("");
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const settleRef = useRef<(kind: "paid" | "cancel" | "unknown") => void>(() => {});
  const payDone = useRef(false);

  async function liveSession(fresh?: boolean): Promise<Session> {
    const token = await getToken(fresh ? { skipCache: true } : undefined);
    if (!isSignedIn || !sessionId || !token) throw new Error("Sign in again.");
    return {
      token,
      sessionId,
      name: user?.firstName || user?.fullName || "member",
      email: user?.primaryEmailAddress?.emailAddress || ""
    };
  }

  async function loadHouse(nextSession?: Session | null) {
    const live = nextSession === undefined ? await liveSession().catch(() => null) : nextSession;
    setMenuLoading(true);
    setMenuError("");
    try {
      const [menu, house, pay] = await Promise.all([
        fetchMenu(),
        fetchHours(),
        fetchPay().catch(() => ({ stripe: false }))
      ]);
      setItems(menu);
      setHours(house);
      setStripe(!!pay.stripe);
      if (live) {
        const [rank, stamp, collection, pace, named] = await Promise.all([
          fetchRank(live).catch(() => ({ driver: false, paused: false })),
          fetchStamps(live).catch(() => ({ stamps: 0, cards_done: 0 })),
          fetchOrders(live).catch(() => null),
          fetchPace(live).catch(() => ({
            how_busy: "",
            how_wait: "",
            pace_at: "",
            admin: false,
            stale: true
          })),
          fetchHandle(live).catch(() => ({ handle: "", suggestions: [] }))
        ]);
        setOnRank(!!rank.driver);
        setDesk(!!pace.admin);
        setHandle(named.handle);
        setHandlePicks(named.suggestions);
        setStamps(stamp.stamps);
        setCardsDone(stamp.cards_done);
        if (collection) {
          setStripe(!!collection.stripe);
          setOrders(collection.orders);
        }
      }
    } catch (err) {
      setMenuError(err instanceof Error ? err.message : "The board could not load.");
    } finally {
      setMenuLoading(false);
    }
  }

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && !wasIn.current) {
      setTab("menu");
      setYouPage("home");
      setLookBoard("pictures");
      setPiece(null);
    }
    if (!isSignedIn && wasIn.current) {
      setOnRank(false);
      setDesk(false);
      setHandle("");
      setHandlePicks([]);
      setBag([]);
      setNote("");
      setOrders([]);
      setStamps(0);
      setBagStatus("");
      setToast("");
      setYouPage("home");
    }
    wasIn.current = !!isSignedIn;
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !sessionId) return;
    liveSession().then(loadHouse).catch(() => {});
  }, [isLoaded, isSignedIn, sessionId]);

  useEffect(() => {
    loadPrefs().then((next) => {
      setPrefs(next);
      setNote((current) => current || next.bagNote);
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  const watchingCup = orders.some((order) => isWatchingOrder(order.status));

  useEffect(() => {
    if (!isSignedIn || !watchingCup) return;
    let on = true;
    const tick = () => {
      liveSession()
        .then(fetchOrders)
        .then((collection) => {
          if (!on || !collection) return;
          setStripe(!!collection.stripe);
          setOrders(collection.orders);
        })
        .catch(() => {});
    };
    const timer = setInterval(tick, 8000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => {
      on = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [isSignedIn, watchingCup]);

  const seenStatus = useRef<Record<string, string>>({});
  useEffect(() => {
    orders.forEach((order) => {
      const was = seenStatus.current[order.id];
      if (was && was !== order.status) {
        if (order.status === "ready") ok();
        else if (isLiveOrder(order.status)) tap();
      }
      seenStatus.current[order.id] = order.status;
    });
  }, [orders]);

  useEffect(() => {
    if (!items.length) return;
    setBag((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        const item = items.find((it) => String(it.id || it.name) === row.id);
        if (!item) return row;
        const price = priceOf(item, onRank);
        const rank = onRankPrice(item, onRank);
        if (row.price_gbp === price && row.rank === rank && row.name === item.name) return row;
        changed = true;
        return { ...row, name: item.name, price_gbp: price, rank };
      });
      return changed ? next : prev;
    });
  }, [items, onRank]);

  function addItem(item: MenuItem) {
    const price = priceOf(item, onRank);
    const rank = onRankPrice(item, onRank);
    const id = String(item.id || item.name);
    const existing = bag.find((row) => row.id === id);
    if (existing && existing.qty >= BAG_QTY_MAX) {
      warn();
      setToast("That’s as many as the counter will take.");
      return;
    }
    if (!existing && bag.length >= BAG_LINES_MAX) {
      warn();
      setToast("The bag is full.");
      return;
    }
    tap();
    if (!note && prefs.bagNote) setNote(prefs.bagNote);
    setBag((prev) => {
      const index = prev.findIndex((row) => row.id === id);
      if (index >= 0) {
        return prev.map((row, i) =>
          i === index ? { ...row, qty: Math.min(BAG_QTY_MAX, row.qty + 1) } : row
        );
      }
      return [...prev, { id, name: item.name, price_gbp: price, qty: 1, rank }];
    });
    setToast("Added " + item.name + (rank ? " on the rank." : "."));
  }

  function changeQty(id: string, delta: number) {
    const row = bag.find((line) => line.id === id);
    if (!row) return;
    if (delta > 0 && row.qty >= BAG_QTY_MAX) {
      warn();
      setToast("That’s as many as the counter will take.");
      return;
    }
    tap();
    setBag((prev) =>
      prev
        .map((line) =>
          line.id === id
            ? { ...line, qty: Math.min(BAG_QTY_MAX, Math.max(0, line.qty + delta)) }
            : line
        )
        .filter((line) => line.qty > 0)
    );
  }

  function markPaid() {
    ok();
    setBag([]);
    setNote(prefsRef.current.bagNote);
    setBagStatus("Paid. The house has it.");
  }

  async function settlePay(kind: "paid" | "cancel" | "unknown") {
    if (payDone.current) {
      if (kind === "paid") {
        pendingPayId.current = "";
        markPaid();
        liveSession().then(loadHouse).catch(() => {});
      }
      return;
    }
    payDone.current = true;
    const id = pendingPayId.current;
    setPaying(false);

    if (kind === "paid") {
      pendingPayId.current = "";
      markPaid();
      liveSession().then(loadHouse).catch(() => {});
      return;
    }

    if (id) {
      try {
        const live = await liveSession();
        const collection = await fetchOrders(live).catch(() => null);
        const row = collection?.orders.find((order) => order.id === id);
        if (row && (row.paid || isLiveOrder(row.status))) {
          pendingPayId.current = "";
          if (collection) {
            setStripe(!!collection.stripe);
            setOrders(collection.orders);
          }
          markPaid();
          return;
        }
        if (kind === "cancel") {
          await cancelOrder(live, id).catch(() => {});
        }
        await loadHouse(live);
      } catch {
        // keep the bag if the house cannot settle yet
      }
    }

    pendingPayId.current = "";
    setBagStatus(
      kind === "cancel"
        ? "The card was let go. The bag is still here."
        : "Come back to the bag if the card is still open."
    );
  }

  settleRef.current = (kind) => {
    void settlePay(kind);
  };

  async function pay(method: "stripe" | "counter") {
    if (!bag.length) return;
    tap();
    setBusy(true);
    setBagStatus(method === "stripe" ? "Opening the card…" : "Sending to the counter…");
    try {
      const live = await liveSession(true);
      const data = await placeOrder(
        live,
        bag,
        note,
        method,
        method === "stripe" ? Linking.createURL("pay") : ""
      );
      if (data.url) {
        pendingPayId.current = String((data.order && data.order.id) || "");
        payDone.current = false;
        setBusy(false);
        setPaying(true);
        const redirect = Linking.createURL("pay");
        try {
          const result = await WebBrowser.openAuthSessionAsync(String(data.url), redirect);
          if (result.type !== "success") {
            await settlePay("cancel");
            return;
          }
          const href = String(result.url || "");
          const kind = payHrefKind(href);
          if (kind === "paid") {
            await settlePay("paid");
            return;
          }
          if (kind === "cancel") {
            await settlePay("cancel");
            return;
          }
          if (/^(blanco|exp):\/\//i.test(href)) {
            await settlePay("unknown");
            return;
          }
          await settlePay("unknown");
        } catch {
          await settlePay("unknown");
        }
        return;
      }
      ok();
      setBag([]);
      setNote(prefsRef.current.bagNote);
      setBagStatus("At the counter. Pay when you collect.");
      loadHouse(live);
    } catch (err) {
      warn();
      pendingPayId.current = "";
      setPaying(false);
      setBagStatus(err instanceof Error ? err.message : "The counter could not take that.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const sub = Linking.addEventListener("url", (event) => {
      const kind = payHrefKind(event.url);
      if (kind === "paid" || kind === "cancel") settleRef.current(kind);
    });
    return () => sub.remove();
  }, []);

  async function saveName(next: string) {
    if (!user) throw new Error("Sign in again.");
    await user.update({ firstName: next.trim() });
  }

  async function saveHandle(next: string) {
    const live = await liveSession();
    const data = await pickHandle(live, next);
    setHandle(data.handle);
    setHandlePicks(data.suggestions);
  }

  async function shuffleHandles() {
    const live = await liveSession();
    const data = await moreHandles(live);
    if (data.handle) setHandle(data.handle);
    setHandlePicks(data.suggestions);
  }

  async function savePace(patch: { how_busy?: string; how_wait?: string }) {
    const live = await liveSession();
    const data = await postPace(live, patch);
    setHours((current) =>
      current
        ? {
            ...current,
            how_busy: String(data.how_busy || ""),
            how_wait: String(data.how_wait || ""),
            pace_at: String(data.pace_at || "")
          }
        : current
    );
  }

  async function savePassword(current: string, next: string) {
    if (!user) throw new Error("Sign in again.");
    const resource = user as {
      updatePassword?: (args: { currentPassword: string; newPassword: string }) => Promise<unknown>;
    };
    if (!resource.updatePassword) {
      throw new Error("That password cannot be changed in the app yet.");
    }
    await resource.updatePassword({ currentPassword: current, newPassword: next });
  }

  async function onJoinRank() {
    tap();
    try {
      const live = await liveSession();
      await joinRank(live, rankCode);
      ok();
      setOnRank(true);
      setRankNote("You’re on the rank.");
      setRankCode("");
      loadHouse(live);
    } catch (err) {
      warn();
      setRankNote(err instanceof Error ? err.message : "That code is not for the rank.");
    }
  }

  if (!isLoaded) {
    return (
      <View style={styles.bootFull}>
        <Image source={require("./assets/mark.png")} style={styles.gateMark} />
        <Text style={styles.bootWord}>blanco.</Text>
        <Text style={styles.tag}>your way.</Text>
      </View>
    );
  }

  if (!isSignedIn) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" backgroundColor={BEIGE} />
        <Gate />
        <Grain />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" backgroundColor={BEIGE} />
      <View style={styles.stage}>
          <Rise key={tab} style={styles.stage}>
          {tab === "menu" ? (
            <MenuScreen
              items={items}
              hours={hours}
              onRank={onRank}
              loading={menuLoading}
              error={menuError}
              held={bag}
              onRefresh={() => loadHouse()}
              onAdd={addItem}
              onQty={changeQty}
              onHouse={() => {
                setYouPage("house");
                setTab("you");
              }}
            />
          ) : null}
          {tab === "look" ? (
            <LookScreen
              board={lookBoard}
              onBoard={setLookBoard}
              piece={piece}
              onOpen={setPiece}
              onBackPiece={() => setPiece(null)}
              getSession={liveSession}
            />
          ) : null}
          {tab === "bag" ? (
            <BagScreen
              bag={bag}
              note={note}
              stripe={stripe}
              prefer={prefs.pay}
              status={bagStatus}
              busy={busy}
              items={items}
              hours={hours}
              onRank={onRank}
              orders={orders}
              refreshing={menuLoading}
              onNote={setNote}
              onQty={changeQty}
              onClear={() => {
                setBag([]);
                setBagStatus("");
              }}
              onPay={pay}
              onMenu={() => setTab("menu")}
              onReorder={(order) => {
                const lines = linesFromOrder(order, items, onRank);
                if (!lines.length) {
                  warn();
                  setBagStatus("That’s not on the board today.");
                  return;
                }
                tap();
                setBag(lines);
                setNote(order.note || prefs.bagNote);
                setBagStatus(
                  bagQty(lines) <
                  (order.items || []).reduce((sum, row) => sum + (Number(row.qty) || 0), 0)
                    ? "Some of that is not on the board today. The rest is in the bag."
                    : ""
                );
              }}
              onCancelOrder={(id) => {
                liveSession()
                  .then((live) =>
                    cancelOrder(live, id).then(() => {
                      ok();
                      return loadHouse(live);
                    })
                  )
                  .catch((err) => {
                    warn();
                    setBagStatus(
                      err instanceof Error
                        ? err.message
                        : "That collection could not come off."
                    );
                  });
              }}
              onRefresh={() => loadHouse()}
            />
          ) : null}
          {tab === "you" ? (
            <YouStack
              page={youPage}
              onPage={setYouPage}
              hours={hours}
              name={user?.firstName || user?.fullName || ""}
              email={user?.primaryEmailAddress?.emailAddress || ""}
              handle={handle}
              handlePicks={handlePicks}
              onSaveHandle={saveHandle}
              onMoreHandles={shuffleHandles}
              stamps={stamps}
              cardsDone={cardsDone}
              bagHint={bagHintLine(orders)}
              onBag={() => setTab("bag")}
              onRank={onRank}
              desk={desk}
              onHowLive={savePace}
              rankNote={rankNote}
              rankCode={rankCode}
              refreshing={menuLoading}
              stripe={stripe}
              prefs={prefs}
              onPrefs={(next) => {
                setPrefs(next);
                if (!bag.length) setNote(next.bagNote);
              }}
              onRankCode={setRankCode}
              onJoinRank={onJoinRank}
              onRefresh={() => loadHouse()}
              onSaveName={saveName}
              onSavePassword={savePassword}
              passwordOn={!!user?.passwordEnabled}
              onPictures={() => {
                setLookBoard("pictures");
                setTab("look");
              }}
              onToday={() => {
                setLookBoard("today");
                setTab("look");
              }}
              onSignOut={() => {
                Alert.alert(
                  "Leave the house?",
                  "You’ll need to sign in again for the bag and the stamps.",
                  [
                    { text: "Stay", style: "cancel" },
                    {
                      text: "Sign out",
                      style: "destructive",
                      onPress: () => signOut()
                    }
                  ]
                );
              }}
            />
          ) : null}
          </Rise>
        </View>

      {paying ? (
        <View style={styles.pay}>
          <View style={[styles.payBar, { paddingTop: pad.top }]}>
            <Back label="let go" onPress={() => settlePay("cancel")} />
            <Text style={styles.payTitle}>the card.</Text>
            <View style={{ width: 52 }} />
          </View>
          <View style={styles.payWait}>
            <Text style={styles.prose}>Safari has the card. Come back here when it’s paid.</Text>
          </View>
        </View>
      ) : null}

      {toast && tab !== "bag" ? (
        <Rise key={toast} style={[styles.toastLift, { bottom: pad.toast }]}>
          <Pressable
            onPress={() => {
              tap();
              setToast("");
              setTab("bag");
            }}
            style={styles.toast}
          >
            <Text style={styles.toastText}>{toast}</Text>
            <Text style={styles.toastGo}>the bag</Text>
          </Pressable>
        </Rise>
      ) : null}

      {paying ? null : (
        <Tabs tab={tab} bagCount={bagQty(bag)} onTab={(next) => {
          setPiece(null);
          setToast("");
          if (next === "you" && tab === "you") setYouPage("home");
          if (next === "look" && tab === "look") setLookBoard("pictures");
          setTab(next);
        }} />
      )}
      <Grain />
    </View>
  );
}

const styles = StyleSheet.create({
  grain: {
    position: "absolute",
    top: 0,
    left: 0,
    opacity: 0.1,
    overflow: "hidden",
    zIndex: 40
  },
  kicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10
  },
  kickerMark: {
    width: 26,
    height: 26,
    borderRadius: 13
  },
  kickerText: {
    fontFamily: SANS_MED,
    fontSize: 12,
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: MUTED
  },
  bootFull: {
    flex: 1,
    backgroundColor: BEIGE,
    alignItems: "center",
    justifyContent: "center"
  },
  bootWord: {
    marginTop: 12,
    fontFamily: "Georgia",
    fontSize: 34,
    fontStyle: "italic",
    color: BROWN,
    letterSpacing: -0.8
  },
  root: {
    flex: 1,
    backgroundColor: BEIGE
  },
  stage: {
    flex: 1
  },
  gateMark: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: 12
  },
  tag: {
    marginTop: 6,
    fontFamily: SANS_MED,
    fontSize: 11,
    letterSpacing: 3.4,
    textTransform: "uppercase",
    color: MUTED
  },
  screen: {
    flex: 1,
    backgroundColor: BEIGE
  },
  screenInner: {
    paddingHorizontal: 24
  },
  sticky: {
    zIndex: 2,
    paddingHorizontal: 24,
    paddingBottom: 10,
    backgroundColor: BEIGE,
    borderBottomWidth: 1,
    borderBottomColor: LINE
  },
  title: {
    fontFamily: ROUND,
    fontSize: 38,
    letterSpacing: -1.1,
    color: BROWN,
    marginBottom: 8,
    textTransform: "lowercase",
    lineHeight: 42
  },
  hours: {
    fontFamily: SANS,
    fontSize: 15,
    color: MUTED,
    marginBottom: 8
  },
  notice: {
    fontFamily: SANS_MED,
    fontSize: 15,
    color: BROWN,
    marginBottom: 12
  },
  prose: {
    fontFamily: SANS,
    fontSize: 16,
    lineHeight: 26,
    color: MUTED,
    maxWidth: 420
  },
  closing: {
    marginTop: 16,
    marginBottom: 24,
    fontFamily: ROUND,
    fontSize: 22,
    letterSpacing: -0.6,
    color: BROWN,
    lineHeight: 26
  },
  section: {
    marginTop: 20
  },
  sectionTitle: {
    fontFamily: SERIF,
    fontSize: 20,
    color: BROWN,
    marginTop: 22,
    marginBottom: 10,
    letterSpacing: -0.3
  },
  cupTrack: {
    marginTop: 18,
    paddingTop: 4,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: LINE
  },
  cupTrackReady: {
    borderLeftWidth: 3,
    borderLeftColor: BROWN,
    paddingLeft: 12
  },
  cupNow: {
    fontFamily: SERIF_ITALIC,
    fontSize: 26,
    letterSpacing: -0.6,
    color: BROWN,
    marginBottom: 16,
    lineHeight: 30
  },
  cupRail: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    marginBottom: 8
  },
  cupLink: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(80,57,49,0.16)",
    marginHorizontal: 4
  },
  cupLinkOn: {
    backgroundColor: BROWN
  },
  cupDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(80,57,49,0.32)",
    backgroundColor: "transparent"
  },
  cupDotDone: {
    backgroundColor: BROWN,
    borderColor: BROWN
  },
  cupDotNow: {
    backgroundColor: BROWN,
    borderColor: BROWN,
    transform: [{ scale: 1.18 }]
  },
  cupLabels: {
    flexDirection: "row",
    marginBottom: 14
  },
  cupStep: {
    flex: 1,
    textAlign: "center",
    fontFamily: SANS_MED,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: MUTED
  },
  cupStepOn: {
    color: BROWN
  },
  item: {
    paddingVertical: 8
  },
  itemTop: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8
  },
  leader: {
    flex: 1,
    borderBottomWidth: 1.5,
    borderBottomColor: "rgba(80,57,49,0.18)",
    borderStyle: "dotted",
    transform: [{ translateY: -4 }]
  },
  rowSold: {
    opacity: 0.42
  },
  rowName: {
    fontFamily: SANS_MED,
    fontSize: 16,
    color: BROWN
  },
  rowDesc: {
    marginTop: 4,
    marginBottom: 2,
    fontFamily: SANS,
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
    maxWidth: 360
  },
  rowPrice: {
    fontFamily: SANS_MED,
    fontSize: 14,
    color: MUTED,
    fontVariant: ["tabular-nums"]
  },
  rankMark: {
    marginTop: 4,
    fontFamily: SANS_SEMI,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: MUTED
  },
  soldMark: {
    fontFamily: SANS_SEMI,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: BROWN
  },
  add: {
    borderWidth: 1.5,
    borderColor: BROWN,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    minWidth: 58,
    alignItems: "center"
  },
  addOn: {
    backgroundColor: BROWN
  },
  addText: {
    fontFamily: SANS_MED,
    color: BROWN,
    fontSize: 13
  },
  addTextOn: {
    color: BEIGE
  },
  error: {
    marginTop: 12,
    fontFamily: SANS,
    color: BROWN
  },
  bagLine: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: LINE
  },
  bagCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4
  },
  bagLinePrice: {
    minWidth: 44,
    textAlign: "right",
    fontFamily: SANS_MED,
    fontSize: 14,
    color: BROWN,
    fontVariant: ["tabular-nums"]
  },
  past: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: LINE
  },
  pastStatus: {
    fontFamily: SANS_MED,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: MUTED,
    marginBottom: 4
  },
  pastItems: {
    fontFamily: SANS,
    fontSize: 16,
    color: BROWN,
    marginBottom: 4
  },
  pastPrice: {
    fontFamily: SANS_MED,
    fontSize: 14,
    color: BROWN,
    fontVariant: ["tabular-nums"]
  },
  pastNote: {
    marginTop: 6,
    fontFamily: SANS,
    fontSize: 14,
    lineHeight: 20,
    color: MUTED
  },
  bagDock: {
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 12,
    backgroundColor: BEIGE,
    borderTopWidth: 1,
    borderTopColor: LINE
  },
  bagTotal: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 4,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 1.5,
    borderTopColor: BROWN
  },
  dim: {
    opacity: 0.45
  },
  bagTotalLabel: {
    fontFamily: ROUND,
    fontSize: 22,
    letterSpacing: -0.5,
    color: BROWN
  },
  bagTotalSum: {
    fontFamily: ROUND,
    fontSize: 28,
    letterSpacing: -0.8,
    color: BROWN,
    fontVariant: ["tabular-nums"]
  },
  qty: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    gap: 8
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BROWN,
    alignItems: "center",
    justifyContent: "center"
  },
  qtyMark: {
    fontFamily: SANS_MED,
    fontSize: 16,
    color: BROWN,
    marginTop: -1
  },
  qtyCount: {
    minWidth: 16,
    textAlign: "center",
    fontFamily: SANS_MED,
    fontSize: 15,
    color: BROWN,
    fontVariant: ["tabular-nums"]
  },
  link: {
    marginTop: 12,
    fontFamily: SERIF_ITALIC,
    fontSize: 17,
    color: BROWN
  },
  label: {
    marginTop: 22,
    marginBottom: 8,
    fontFamily: SANS_MED,
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: MUTED
  },
  input: {
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: PAPER,
    color: BROWN,
    fontFamily: SANS,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    borderRadius: 2,
    marginBottom: 8
  },
  status: {
    marginTop: 10,
    marginBottom: 8,
    fontFamily: SANS,
    fontSize: 15,
    color: BROWN
  },
  payHint: {
    marginTop: 4,
    marginBottom: 4,
    fontFamily: SANS,
    fontSize: 14,
    lineHeight: 20,
    color: MUTED
  },
  stamps: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    marginTop: 4
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: BROWN
  },
  dotOn: {
    backgroundColor: BROWN
  },
  order: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: LINE
  },
  orderStatus: {
    fontFamily: SANS_MED,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: MUTED,
    marginBottom: 4
  },
  orderItems: {
    fontFamily: SANS,
    fontSize: 16,
    color: BROWN,
    marginBottom: 4
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 22
  },
  card: {
    width: "48%",
    marginBottom: 16
  },
  cardFrame: {
    width: "100%",
    aspectRatio: 2 / 3,
    overflow: "hidden",
    backgroundColor: PAPER,
    borderWidth: 1,
    borderColor: LINE
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }]
  },
  cardImage: {
    width: "100%",
    height: "100%"
  },
  cardName: {
    marginTop: 10,
    fontFamily: ROUND,
    fontSize: 22,
    color: BROWN,
    letterSpacing: -0.5
  },
  cardLine: {
    marginTop: 4,
    fontFamily: SANS,
    fontSize: 13,
    lineHeight: 18,
    color: MUTED
  },
  btn: {
    marginTop: 10,
    backgroundColor: BROWN,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16
  },
  btnText: {
    fontFamily: SANS_MED,
    color: BEIGE,
    fontSize: 15,
    letterSpacing: 0.2
  },
  btnGhost: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: BROWN,
    paddingVertical: 13,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16
  },
  btnGhostText: {
    fontFamily: SANS_MED,
    color: BROWN,
    fontSize: 15,
    letterSpacing: 0.4
  },
  piece: {
    flex: 1,
    backgroundColor: BEIGE,
    paddingHorizontal: 22
  },
  back: {
    fontFamily: SERIF_ITALIC,
    fontSize: 18,
    color: BROWN,
    marginBottom: 12
  },
  pieceFrame: {
    flex: 1,
    minHeight: 280,
    overflow: "hidden",
    backgroundColor: PAPER,
    borderWidth: 1,
    borderColor: LINE
  },
  pieceImage: {
    width: "100%",
    height: "100%"
  },
  pieceName: {
    marginTop: 16,
    fontFamily: ROUND,
    fontSize: 32,
    color: BROWN,
    letterSpacing: -0.8
  },
  pieceLine: {
    marginTop: 8,
    marginBottom: 16,
    fontFamily: SANS,
    fontSize: 16,
    lineHeight: 24,
    color: MUTED
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingTop: 8,
    backgroundColor: PAPER,
    borderTopWidth: 1,
    borderTopColor: LINE
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 6
  },
  tabText: {
    color: MUTED,
    fontFamily: SANS_MED,
    fontSize: 11,
    letterSpacing: 0.6
  },
  tabTextOn: {
    color: BROWN
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: BROWN,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeText: {
    fontFamily: SANS_MED,
    fontSize: 10,
    color: BEIGE
  },
  toastLift: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 50
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: PAPER,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 18
  },
  toastText: {
    flex: 1,
    fontFamily: SANS,
    fontSize: 15,
    color: BROWN
  },
  toastGo: {
    fontFamily: SERIF_ITALIC,
    fontSize: 16,
    color: BROWN
  },
  pay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BEIGE,
    zIndex: 60
  },
  payBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 8
  },
  payTitle: {
    fontFamily: ROUND,
    fontSize: 20,
    color: BROWN,
    letterSpacing: -0.4
  },
  payWait: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28
  }
});
