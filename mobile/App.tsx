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
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
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
import { WebView } from "react-native-webview";
import { Gate } from "./auth";
import { ok, tap, warn } from "./feel";
import {
  bagQty,
  bagTotal,
  BAG_LINES_MAX,
  BAG_QTY_MAX,
  fetchHours,
  fetchMenu,
  fetchOrders,
  fetchRank,
  fetchStamps,
  formatPrice,
  groupBoard,
  houseOpenLine,
  joinRank,
  onRankPrice,
  placeOrder,
  priceOf,
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
import { Kicker } from "./ui";
import { YouStack, type YouPage } from "./you";

type Tab = "menu" | "look" | "bag" | "you";
type Board = "drinks" | "sweets";

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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenInner, { paddingTop: pad.top, paddingBottom: 28 }]}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={BROWN} />
      }
    >
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
        <Text style={styles.hours}>
          {houseOpenLine(hours)}
        </Text>
      </Pressable>
      {hours?.notice ? <Text style={styles.notice}>{hours.notice}</Text> : null}
      <View style={styles.seg}>
        {(["drinks", "sweets"] as const).map((id) => (
          <Pressable
            key={id}
            onPress={() => {
              tap();
              setBoard(id);
            }}
            style={[styles.segBtn, board === id && styles.segOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: board === id }}
          >
            <Text style={[styles.segText, board === id && styles.segTextOn]}>{id}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && !sections.length && !error ? (
        <Text style={styles.prose}>The board is coming up.</Text>
      ) : null}
      {!loading && !error && !sections.length ? (
        <Text style={styles.prose}>The board is quiet. Pull to try again.</Text>
      ) : null}
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
    </ScrollView>
  );
}

function BagScreen({
  bag,
  note,
  stripe,
  prefer,
  status,
  busy,
  onNote,
  onQty,
  onClear,
  onPay,
  onMenu
}: {
  bag: Line[];
  note: string;
  stripe: boolean;
  prefer: PayPref;
  status: string;
  busy: boolean;
  onNote: (next: string) => void;
  onQty: (id: string, delta: number) => void;
  onClear: () => void;
  onPay: (pay: "stripe" | "counter") => void;
  onMenu: () => void;
}) {
  const pad = usePad();
  const empty = bag.length === 0;
  const total = formatPrice(bagTotal(bag));
  const cardFirst = stripe && prefer !== "counter";
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenInner, { paddingTop: pad.top, paddingBottom: empty ? 36 : 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Kicker label="collection" />
        <Text style={styles.title}>the bag.</Text>
        {empty ? (
          <>
            <Text style={styles.prose}>
              Add from the board. Pay now, or at the counter.
            </Text>
            <Pressable
              onPress={() => {
                tap();
                onMenu();
              }}
              style={({ pressed }) => [styles.btn, { marginTop: 22 }, pressed && styles.pressed]}
            >
              <Text style={styles.btnText}>The board</Text>
            </Pressable>
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
          {stripe && cardFirst ? (
            <>
              <Pressable
                disabled={busy}
                onPress={() => onPay("stripe")}
                style={({ pressed }) => [styles.btn, { marginTop: 8 }, pressed && styles.pressed, busy && styles.dim]}
              >
                <Text style={styles.btnText}>{busy ? "Opening the card…" : "Pay now · " + total}</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={() => onPay("counter")}
                style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed, busy && styles.dim]}
              >
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
                <Text style={styles.btnText}>
                  {busy ? "Sending to the counter…" : "Pay at the counter · " + total}
                </Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={() => onPay("stripe")}
                style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed, busy && styles.dim]}
              >
                <Text style={styles.btnGhostText}>Pay now with the card</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              disabled={busy}
              onPress={() => onPay("counter")}
              style={({ pressed }) => [styles.btn, { marginTop: 8 }, pressed && styles.pressed, busy && styles.dim]}
            >
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
      ).map(([id, label]) => (
        <Pressable
          key={id}
          onPress={() => {
            tap();
            onTab(id);
          }}
          style={styles.tab}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === id }}
        >
          <Text style={[styles.tabText, tab === id && styles.tabTextOn]}>{label}</Text>
          {id === "bag" && bagCount ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{bagCount > 9 ? "9+" : String(bagCount)}</Text>
            </View>
          ) : null}
          {tab === id ? <View style={styles.tabLine} /> : null}
        </Pressable>
      ))}
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
  const [bag, setBag] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [stripe, setStripe] = useState(false);
  const [bagStatus, setBagStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [payUrl, setPayUrl] = useState("");
  const [stamps, setStamps] = useState(0);
  const [cardsDone, setCardsDone] = useState(0);
  const [orders, setOrders] = useState<HouseOrder[]>([]);
  const [rankCode, setRankCode] = useState("");
  const [rankNote, setRankNote] = useState("");
  const [toast, setToast] = useState("");

  async function liveSession(): Promise<Session> {
    const token = await getToken();
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
      const [menu, house] = await Promise.all([fetchMenu(), fetchHours()]);
      setItems(menu);
      setHours(house);
      if (live) {
        const [rank, stamp, collection] = await Promise.all([
          fetchRank(live).catch(() => ({ driver: false, paused: false })),
          fetchStamps(live).catch(() => ({ stamps: 0, cards_done: 0 })),
          fetchOrders(live).catch(() => ({ stripe: false, orders: [] as HouseOrder[] }))
        ]);
        setOnRank(!!rank.driver);
        setStamps(stamp.stamps);
        setCardsDone(stamp.cards_done);
        setStripe(!!collection.stripe);
        setOrders(collection.orders);
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
      setBag([]);
      setNote("");
      setOrders([]);
      setStamps(0);
      setBagStatus("");
      setPayUrl("");
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

  async function pay(method: "stripe" | "counter") {
    if (!bag.length) return;
    tap();
    setBusy(true);
    setBagStatus(method === "stripe" ? "Opening the card…" : "Sending to the counter…");
    try {
      const live = await liveSession();
      const data = await placeOrder(live, bag, note, method);
      if (data.url) {
        setPayUrl(String(data.url));
        setBusy(false);
        return;
      }
      ok();
      setBag([]);
      setNote(prefs.bagNote);
      setBagStatus("At the counter. Pay when you collect.");
      loadHouse(live);
    } catch (err) {
      warn();
      setBagStatus(err instanceof Error ? err.message : "The counter could not take that.");
    } finally {
      setBusy(false);
    }
  }

  function closePay(paid: boolean) {
    setPayUrl("");
    if (paid) {
      ok();
      setBag([]);
      setNote(prefs.bagNote);
      setBagStatus("Paid. It’s at the counter.");
      setYouPage("home");
      setTab("you");
      liveSession().then(loadHouse).catch(() => {});
    }
  }

  async function saveName(next: string) {
    if (!user) throw new Error("Sign in again.");
    await user.update({ firstName: next.trim() });
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
              onNote={setNote}
              onQty={changeQty}
              onClear={() => {
                setBag([]);
                setBagStatus("");
              }}
              onPay={pay}
              onMenu={() => setTab("menu")}
            />
          ) : null}
          {tab === "you" ? (
            <YouStack
              page={youPage}
              onPage={setYouPage}
              hours={hours}
              name={user?.firstName || user?.fullName || ""}
              email={user?.primaryEmailAddress?.emailAddress || ""}
              stamps={stamps}
              cardsDone={cardsDone}
              orders={orders}
              onRank={onRank}
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
              onPictures={() => {
                setLookBoard("pictures");
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
        </View>

      {payUrl ? (
        <View style={styles.pay}>
          <View style={[styles.payBar, { paddingTop: pad.top }]}>
            <Pressable onPress={() => closePay(false)} hitSlop={10}>
              <Text style={styles.back}>let go</Text>
            </Pressable>
            <Text style={styles.payTitle}>the card.</Text>
            <View style={{ width: 52 }} />
          </View>
          <WebView
            source={{ uri: payUrl }}
            style={styles.web}
            originWhitelist={["*"]}
            sharedCookiesEnabled
            javaScriptEnabled
            onNavigationStateChange={(nav) => {
              const href = String(nav.url || "").toLowerCase();
              if (href.indexOf("checkout.stripe.com") !== -1) return;
              if (href.indexOf("paid=1") !== -1) {
                closePay(true);
                return;
              }
              if (
                href.indexOf("blancocoffeehouse.com") !== -1 ||
                href.indexOf("blancocoffeehouse") !== -1
              ) {
                closePay(false);
              }
            }}
          />
        </View>
      ) : null}

      {toast && tab !== "bag" ? (
        <Pressable
          onPress={() => {
            tap();
            setToast("");
            setTab("bag");
          }}
          style={[styles.toast, { bottom: pad.toast }]}
        >
          <Text style={styles.toastText}>{toast}</Text>
          <Text style={styles.toastGo}>the bag</Text>
        </Pressable>
      ) : null}

      <Tabs tab={tab} bagCount={bagQty(bag)} onTab={(next) => {
        setPiece(null);
        setToast("");
        if (next === "you" && tab === "you") setYouPage("home");
        if (next === "look" && tab === "look") setLookBoard("pictures");
        setTab(next);
      }} />
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
  web: {
    flex: 1,
    backgroundColor: BEIGE
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
    paddingHorizontal: 22
  },
  title: {
    fontFamily: ROUND,
    fontSize: 40,
    letterSpacing: -1.2,
    color: BROWN,
    marginBottom: 12,
    textTransform: "lowercase",
    lineHeight: 42
  },
  hours: {
    fontFamily: SANS,
    fontSize: 15,
    color: MUTED,
    marginBottom: 12
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
  stamp: {
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderColor: BROWN,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontFamily: ROUND_BOLD,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: BROWN,
    overflow: "hidden",
    marginBottom: 16
  },
  seg: {
    flexDirection: "row",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: 6,
    marginBottom: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 999,
    backgroundColor: PAPER
  },
  segBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999
  },
  segOn: {
    backgroundColor: BROWN
  },
  segText: {
    fontFamily: SANS_SEMI,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: BROWN
  },
  segTextOn: {
    color: BEIGE
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
    paddingVertical: 15,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999
  },
  btnText: {
    fontFamily: SANS_MED,
    color: BEIGE,
    fontSize: 15,
    letterSpacing: 0.4
  },
  btnGhost: {
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: BROWN,
    paddingVertical: 13,
    paddingHorizontal: 22,
    alignItems: "center",
    borderRadius: 999
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
    paddingHorizontal: 8,
    paddingTop: 10,
    backgroundColor: PAPER,
    borderTopWidth: 1,
    borderTopColor: LINE
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8
  },
  tabText: {
    color: BROWN,
    opacity: 0.34,
    fontFamily: ROUND,
    fontSize: 16,
    letterSpacing: -0.3
  },
  tabTextOn: {
    opacity: 1
  },
  tabLine: {
    marginTop: 6,
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: BROWN
  },
  badge: {
    position: "absolute",
    top: 2,
    right: "16%",
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: BROWN,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeText: {
    fontFamily: SANS_MED,
    fontSize: 10,
    color: BEIGE
  },
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: PAPER,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 999,
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
    zIndex: 20
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
  }
});
