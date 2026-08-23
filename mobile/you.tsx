import { useEffect, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { ok, tap, warn } from "./feel";
import {
  fetchOrder,
  fetchReviews,
  formatPrice,
  historyOrders,
  houseBusyLine,
  houseOpenLine,
  houseState,
  orderWhen,
  paceStale,
  receiptShare,
  shortOrderId,
  HOW_BUSY,
  HOW_WAIT,
  type HouseHours,
  type HouseOrder,
  type HouseReviews,
  type LastCup,
  type Line,
  type Session
} from "./house";
import {
  ACCOUNT_URL,
  HOUSE_ADDRESS,
  HOUSE_BOARD,
  HOUSE_POST,
  HOUSE_SITE,
  HOUSE_STREET,
  HOUSE_TOWN,
  INSTAGRAM,
  openAway,
  openHouseMap
} from "./pieces";
import { hasUsual, savePrefs, type Prefs } from "./prefs";
import {
  ROUND,
  SANS,
  SANS_MED,
  SANS_SEMI,
  SERIF_ITALIC,
  usePad,
  useStyles,
  type Palette
} from "./theme";
import { Rise, useToTop } from "./motion";
import { Back, FoldHead, Kicker, Mark, type MarkName } from "./ui";
import { DeskScreen } from "./desk";
import { StampCup } from "./stamp-cup";

export type YouPage = "home" | "house" | "settings" | "desk" | "orders";

type YouStackProps = {
  page: YouPage;
  onPage: (next: YouPage) => void;
  hours: HouseHours | null;
  name: string;
  email: string;
  handle: string;
  handlePicks: string[];
  onSaveHandle: (next: string) => Promise<void>;
  onMoreHandles: () => Promise<void>;
  stamps: number;
  cardsDone: number;
  bagHint: string;
  bagReady: boolean;
  bag: Line[];
  usualHint: string;
  usualReady: boolean;
  lastCups: LastCup[];
  orders: HouseOrder[];
  onUsual: () => void;
  onLastCup: (cup: LastCup) => void;
  onKeepUsual: (id: string, name: string, note?: string) => Promise<void>;
  onClearUsual: () => Promise<void>;
  onBag: () => void;
  onBoard: () => void;
  onRank: boolean;
  desk: boolean;
  onHowLive: (patch: { how_busy?: string; how_wait?: string }) => Promise<void>;
  rankNote: string;
  rankCode: string;
  refreshing: boolean;
  stripe: boolean;
  prefs: Prefs;
  onPrefs: (next: Prefs) => void;
  onRankCode: (next: string) => void;
  onJoinRank: () => void;
  onRefresh: () => void;
  onSignOut: () => void;
  onSaveName: (next: string) => Promise<void>;
  onSavePassword: (current: string, next: string) => Promise<void>;
  passwordOn: boolean;
  onPictures: () => void;
  onToday: () => void;
  topAt: number;
  getSession: () => Promise<Session>;
  onSavedBoard: () => void;
};

export function YouStack(props: YouStackProps) {
  const { styles } = useStyles(makeStyles);
  const page =
    props.page === "house"
      ? "house"
      : props.page === "settings"
        ? "settings"
        : props.page === "desk" && props.desk
          ? "desk"
          : props.page === "orders"
            ? "orders"
            : "home";
  return (
    <Rise key={page} shift={false} style={styles.screen}>
      {page === "house" ? (
        <HouseVisit
          hours={props.hours}
          onBack={() => props.onPage("home")}
          onPictures={props.onPictures}
        />
      ) : page === "settings" ? (
        <SettingsScreen
          name={props.name}
          email={props.email}
          handle={props.handle}
          handlePicks={props.handlePicks}
          onSaveHandle={props.onSaveHandle}
          onMoreHandles={props.onMoreHandles}
          hours={props.hours}
          stripe={props.stripe}
          prefs={props.prefs}
          onPrefs={props.onPrefs}
          bag={props.bag}
          onKeepUsual={props.onKeepUsual}
          onClearUsual={props.onClearUsual}
          onBoard={props.onBoard}
          onSaveName={props.onSaveName}
          onSavePassword={props.onSavePassword}
          passwordOn={props.passwordOn}
          onHouse={() => props.onPage("house")}
          onBack={() => props.onPage("home")}
          onSignOut={props.onSignOut}
        />
      ) : page === "desk" && props.desk ? (
        <DeskScreen
          getSession={props.getSession}
          hoursBusy={props.hours?.how_busy}
          hoursWait={props.hours?.how_wait}
          onHowLive={props.onHowLive}
          onSavedBoard={props.onSavedBoard}
          onBack={() => props.onPage("home")}
          topAt={props.topAt}
        />
      ) : page === "orders" ? (
        <OrdersScreen
          orders={props.orders}
          getSession={props.getSession}
          refreshing={props.refreshing}
          onRefresh={props.onRefresh}
          onBack={() => props.onPage("home")}
          topAt={props.topAt}
        />
      ) : (
        <YouHome {...props} />
      )}
    </Rise>
  );
}

function StampCard({
  stamps,
  note
}: {
  stamps: number;
  note: string;
}) {
  const { t, styles } = useStyles(makeStyles);
  return (
    <View
      style={styles.stampCard}
      accessibilityRole="summary"
      accessibilityLabel={stamps + " of 8 stamps"}
    >
      <View style={styles.stampCardHead}>
        <Image
          source={require("./assets/mark.png")}
          style={styles.stampSeal}
          tintColor={t.night ? t.BROWN : undefined}
        />
        <View style={styles.stampCardCopy}>
          <Text style={styles.stampWord}>blanco.</Text>
          <Text style={styles.stampKicker}>your card.</Text>
        </View>
        <Text style={styles.stampCount}>{stamps}/8</Text>
      </View>
      <View style={styles.stampGrid}>
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} style={styles.stampCup}>
            <StampCup on={i < stamps} />
          </View>
        ))}
      </View>
      <Text style={styles.stampNote}>{note}</Text>
    </View>
  );
}

function firstCall(name: string) {
  return name.trim().split(/\s+/)[0] || "";
}

async function shareBoard() {
  try {
    await Share.share({
      title: "blanco.",
      message: "the board. · " + HOUSE_BOARD,
      url: HOUSE_BOARD
    });
  } catch {
    /* let go */
  }
}

function YouHome({
  name,
  stamps,
  cardsDone,
  bagHint,
  bagReady,
  usualHint,
  usualReady,
  lastCups = [],
  orders = [],
  onUsual,
  onLastCup,
  onBag,
  onRank,
  desk,
  onHowLive,
  rankNote,
  rankCode,
  refreshing,
  hours,
  onRankCode,
  onJoinRank,
  onRefresh,
  onPage,
  onPictures,
  onToday,
  topAt
}: YouStackProps) {
  const { t, styles } = useStyles(makeStyles);
  const pad = usePad();
  const list = useRef<ScrollView>(null);
  useToTop(topAt, list);
  const stampNote =
    stamps === 0 && cardsDone
      ? cardsDone === 1
        ? "A drink on the house, then a new card."
        : cardsDone + " drinks on the house so far."
      : stamps
        ? stamps + " of 8. A drink on the house at eight."
        : "Eight stamps. A drink on the house.";
  const openLine = houseOpenLine(hours);
  const busyLine = houseBusyLine(hours);
  const [paceBusy, setPaceBusy] = useState(false);
  const firstFold = desk ? "now" : "stamps";
  const [fold, setFold] = useState<Record<string, boolean>>({});
  const houseCount = 8 + (lastCups.length ? lastCups.length : 0);

  function foldOn(id: string) {
    return fold[id] ?? id === firstFold;
  }

  function toggleFold(id: string) {
    setFold((prev) => ({ ...prev, [id]: !foldOn(id) }));
  }

  async function setPace(patch: { how_busy?: string; how_wait?: string }) {
    if (paceBusy) return;
    tap();
    setPaceBusy(true);
    try {
      await onHowLive(patch);
      ok();
    } catch {
      warn();
    } finally {
      setPaceBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.sticky, { paddingTop: pad.top }]}>
        <Kicker label="member" />
        <Text style={styles.title}>
          {firstCall(name) ? "welcome, " + firstCall(name) + "." : "you."}
        </Text>
        <Pressable
          onPress={() => {
            tap();
            onPage("house");
          }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="The house hours and the map"
        >
          <Text style={styles.openLine}>{openLine}</Text>
        </Pressable>
        {busyLine ? <Text style={styles.notice}>{busyLine}</Text> : null}
      </View>
      <ScrollView
        ref={list}
        style={styles.screen}
        contentContainerStyle={[styles.screenInner, { paddingTop: 14, paddingBottom: 36 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.BROWN} />
        }
        keyboardShouldPersistTaps="handled"
      >

      {desk ? (
        <View style={styles.foldBlock}>
          <FoldHead
            label="now."
            count={2}
            open={foldOn("now")}
            onPress={() => toggleFold("now")}
          />
          {foldOn("now") ? (
            <>
          <Text style={styles.prose}>
            {paceStale(hours)
              ? "Yesterday’s line is off. Set today’s so the house knows the room."
              : "How the house feels. Customers see this on the board, the bag, and the site while you’re open. It drops off overnight."}
          </Text>
          <Text style={styles.label}>the room</Text>
          <View style={styles.seg}>
            {HOW_BUSY.map((row) => (
              <Pressable
                key={row.id}
                onPress={() => setPace({ how_busy: row.id })}
                disabled={paceBusy}
                style={[
                  styles.segBtn,
                  hours?.how_busy === row.id && styles.segOn,
                  paceBusy && styles.dim
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: hours?.how_busy === row.id }}
              >
                <Text
                  style={[
                    styles.segText,
                    hours?.how_busy === row.id && styles.segTextOn
                  ]}
                >
                  {row.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setPace({ how_busy: "" })}
              disabled={paceBusy}
              style={[styles.segBtn, !hours?.how_busy && styles.segOn, paceBusy && styles.dim]}
              accessibilityRole="button"
              accessibilityState={{ selected: !hours?.how_busy }}
            >
              <Text style={[styles.segText, !hours?.how_busy && styles.segTextOn]}>clear</Text>
            </Pressable>
          </View>
          <Text style={styles.label}>the counter</Text>
          <View style={styles.seg}>
            {HOW_WAIT.map((row) => (
              <Pressable
                key={row.id}
                onPress={() => setPace({ how_wait: row.id })}
                disabled={paceBusy}
                style={[
                  styles.segBtn,
                  hours?.how_wait === row.id && styles.segOn,
                  paceBusy && styles.dim
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: hours?.how_wait === row.id }}
              >
                <Text
                  style={[
                    styles.segText,
                    hours?.how_wait === row.id && styles.segTextOn
                  ]}
                >
                  {row.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setPace({ how_wait: "" })}
              disabled={paceBusy}
              style={[styles.segBtn, !hours?.how_wait && styles.segOn, paceBusy && styles.dim]}
              accessibilityRole="button"
              accessibilityState={{ selected: !hours?.how_wait }}
            >
              <Text style={[styles.segText, !hours?.how_wait && styles.segTextOn]}>clear</Text>
            </Pressable>
          </View>
            </>
          ) : null}
        </View>
      ) : null}

      {desk ? (
        <Row
          mark="desk"
          label="the desk."
          hint="the counter, today, the card, the board"
          onPress={() => onPage("desk")}
        />
      ) : null}

      <View style={[styles.foldBlock, !desk && styles.sectionFirst]}>
        <FoldHead
          label="stamps."
          count={stamps + "/8"}
          open={foldOn("stamps")}
          onPress={() => toggleFold("stamps")}
        />
        {foldOn("stamps") ? <StampCard stamps={stamps} note={stampNote} /> : null}
      </View>

      <View style={styles.foldBlock}>
        <FoldHead
          label="the rank."
          open={foldOn("rank")}
          onPress={() => toggleFold("rank")}
        />
        {foldOn("rank") ? (
          <>
      {onRank ? (
        <Text style={styles.prose}>You’re on the rank. Selected drinks sit at the concession.</Text>
      ) : (
        <>
          <Text style={styles.prose}>
            The taxi base next door. Ask at the counter for the house code.
          </Text>
          <TextInput
            value={rankCode}
            onChangeText={onRankCode}
            placeholder="RANK-····"
            placeholderTextColor={t.MUTED}
            keyboardAppearance={t.night ? "dark" : "light"}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.input}
          />
          <Pressable
            onPress={onJoinRank}
            style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}
          >
            <Text style={styles.btnGhostText}>Join the rank</Text>
          </Pressable>
        </>
      )}
      {rankNote ? <Text style={styles.status}>{rankNote}</Text> : null}
          </>
        ) : null}
      </View>

      <View style={styles.foldBlock}>
        <FoldHead
          label="the house."
          count={houseCount}
          open={foldOn("house")}
          onPress={() => toggleFold("house")}
        />
        {foldOn("house") ? (
          <>
      <Row
        mark="bag"
        label="the bag"
        hint={bagHint}
        hot={bagReady}
        onPress={onBag}
      />
      <Row
        mark="card"
        label="receipts."
        hint={
          historyOrders(orders).length
            ? historyOrders(orders).length + " from the house"
            : "from the house."
        }
        onPress={() => onPage("orders")}
      />
      <Row
        mark="counter"
        label="the usual."
        hint={usualHint}
        hot={usualReady}
        onPress={onUsual}
      />
      {lastCups.length ? (
        <View style={styles.lastCups}>
          <Text style={styles.lastCupsWord}>last cups.</Text>
          {lastCups.map((cup) => (
            <Pressable
              key={cup.id + ":" + cup.name}
              onPress={() => {
                tap();
                onLastCup(cup);
              }}
              style={({ pressed }) => [styles.lastCup, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={"Add " + cup.name + " to the bag"}
            >
              <Text style={styles.lastCupName}>{cup.name}</Text>
              <Text style={styles.lastCupCue}>add</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Row
        mark="map"
        label="Fiveways Parade"
        hint={openLine}
        onPress={() => onPage("house")}
      />
      <Row
        mark="pictures"
        label="the pictures"
        hint="the house, in pictures"
        onPress={onPictures}
      />
      <Row
        mark="today"
        label="today"
        hint="your cup, with the house"
        onPress={onToday}
      />
      <Row
        mark="share"
        label="share the board"
        hint="the table QR · the public board"
        onPress={shareBoard}
      />
      <Row
        mark="settings"
        label="settings"
        hint="Your name, the usual, the card"
        onPress={() => onPage("settings")}
      />
          </>
        ) : null}
      </View>
    </ScrollView>
    </View>
  );
}

function OrdersScreen({
  orders,
  getSession,
  refreshing,
  onRefresh,
  onBack,
  topAt
}: {
  orders: HouseOrder[];
  getSession: () => Promise<Session>;
  refreshing: boolean;
  onRefresh: () => void;
  onBack: () => void;
  topAt: number;
}) {
  const { t, styles } = useStyles(makeStyles);
  const pad = usePad();
  const list = useRef<ScrollView>(null);
  useToTop(topAt, list);
  const past = historyOrders(orders);
  const [open, setOpen] = useState<HouseOrder | null>(null);

  useEffect(() => {
    if (!open) return;
    let gone = false;
    getSession()
      .then((session) => fetchOrder(session, open.id))
      .then((row) => {
        if (!gone && row) setOpen(row);
      })
      .catch(() => {});
    return () => {
      gone = true;
    };
  }, [open?.id]);

  if (open) {
    return <ReceiptScreen order={open} onBack={() => setOpen(null)} />;
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.sticky, { paddingTop: pad.top }]}>
        <Back label="you." onPress={onBack} />
        <Kicker label="receipts" />
        <Text style={styles.title}>from the house.</Text>
      </View>
      <ScrollView
        ref={list}
        style={styles.screen}
        contentContainerStyle={[styles.screenInner, { paddingTop: 14, paddingBottom: 36 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.BROWN} />
        }
      >
        <Text style={styles.prose}>
          Collections you’ve paid and taken. Open a receipt from the house, or the card receipt from Stripe.
        </Text>
        {past.length ? (
          past.map((order) => (
            <Pressable
              key={order.id}
              onPress={() => {
                tap();
                setOpen(order);
              }}
              style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={"Receipt for " + (order.items || []).map((row) => row.name).join(", ")}
            >
              <Text style={styles.historyWhen}>{orderWhen(order) || "collected."}</Text>
              <Text style={styles.historyItems}>
                {(order.items || [])
                  .map((row) => row.qty + " × " + row.name)
                  .join(" · ")}
              </Text>
              <Text style={styles.historyTotal}>
                {formatPrice(order.total_gbp) + (order.paid ? " · paid" : "")}
              </Text>
            </Pressable>
          ))
        ) : (
          <Text style={styles.prose}>
            Pay a collection from the board. When you take it, the receipt sits here.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

function ReceiptScreen({
  order,
  onBack
}: {
  order: HouseOrder;
  onBack: () => void;
}) {
  const { t, styles } = useStyles(makeStyles);
  const pad = usePad();

  async function shareReceipt() {
    tap();
    try {
      await Share.share({
        title: "blanco.",
        message: receiptShare(order)
      });
    } catch {
      /* let go */
    }
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.sticky, { paddingTop: pad.top }]}>
        <Back label="receipts." onPress={onBack} />
        <Kicker label="receipt" />
        <Text style={styles.title}>blanco.</Text>
      </View>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenInner, { paddingTop: 14, paddingBottom: 36 }]}
      >
        <View style={styles.receiptPaper} accessibilityRole="summary">
          <View style={styles.receiptHead}>
            <Image
              source={require("./assets/mark.png")}
              style={styles.receiptSeal}
              tintColor={t.night ? t.BROWN : undefined}
            />
            <View style={styles.stampCardCopy}>
              <Text style={styles.stampWord}>blanco.</Text>
              <Text style={styles.stampKicker}>the house.</Text>
            </View>
          </View>
          <Text style={styles.receiptPlace}>4 Fiveways Parade, Hazel Grove · SK7 6DG</Text>
          {orderWhen(order) ? (
            <Text style={styles.receiptMeta}>{orderWhen(order)}</Text>
          ) : null}
          {(order.items || []).map((row, i) => {
            const qty = Number(row.qty) || 1;
            const price = formatPrice((Number(row.price_gbp) || 0) * qty);
            return (
              <View key={order.id + ":" + i} style={styles.receiptLine}>
                <Text style={styles.receiptName}>{qty + " × " + row.name}</Text>
                <View style={styles.receiptLeader} />
                <Text style={styles.receiptPrice}>{price}</Text>
              </View>
            );
          })}
          {order.note ? <Text style={styles.receiptMeta}>{order.note}</Text> : null}
          <View style={styles.receiptLine}>
            <Text style={styles.receiptTotalLabel}>total</Text>
            <View style={styles.receiptLeader} />
            <Text style={styles.receiptTotalPrice}>{formatPrice(order.total_gbp)}</Text>
          </View>
          <Text style={styles.receiptPaid}>
            {order.paid
              ? order.status === "collected"
                ? "paid · collected."
                : "paid."
              : "collected."}
          </Text>
          <Text style={styles.receiptId}>{shortOrderId(order.id)}</Text>
        </View>
        <Pressable
          onPress={shareReceipt}
          style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.btnGhostText}>Share</Text>
        </Pressable>
        {order.receipt_url ? (
          <Pressable
            onPress={() => {
              tap();
              openAway(order.receipt_url || "");
            }}
            style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}
            accessibilityRole="link"
          >
            <Text style={styles.btnGhostText}>Card receipt</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function HouseVisit({
  hours,
  onBack,
  onPictures
}: {
  hours: HouseHours | null;
  onBack: () => void;
  onPictures: () => void;
}) {
  const { t, styles } = useStyles(makeStyles);
  const pad = usePad();
  const state = houseState(hours);
  const openWord = state === "open" ? "open now." : state === "closing" ? "closing soon." : "closed now.";
  const [reviews, setReviews] = useState<HouseReviews | null>(null);

  useEffect(() => {
    fetchReviews().then(setReviews).catch(() => {});
  }, []);

  async function shareHouse() {
    tap();
    try {
      await Share.share({
        title: "blanco.",
        message: "blanco. · " + HOUSE_ADDRESS + " · " + HOUSE_SITE,
        url: HOUSE_SITE
      });
    } catch {
      /* let go */
    }
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.sticky, { paddingTop: pad.top }]}>
        <Back label="you." onPress={onBack} />
        <Kicker label="visit" />
        <Text style={styles.title}>the house.</Text>
        <Text style={styles.stamp}>{openWord}</Text>
      </View>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenInner, { paddingTop: 14, paddingBottom: 36 }]}
      >
      <Text style={styles.prose}>
        {(hours?.hours_days || "Monday–Sunday") + " · " + (hours?.hours_range || "11am–8pm")}
      </Text>
      {hours?.hours_line ? <Text style={styles.hours}>{hours.hours_line}</Text> : null}
      {houseBusyLine(hours) ? <Text style={styles.notice}>{houseBusyLine(hours)}</Text> : null}
      {hours?.notice ? <Text style={styles.notice}>{hours.notice}</Text> : null}
      <Text style={styles.address}>
        {HOUSE_STREET}
        {"\n"}
        {HOUSE_TOWN}
        {"\n"}
        {HOUSE_POST}
      </Text>
      <Pressable
        onPress={() => {
          tap();
          openHouseMap();
        }}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      >
        <Mark name="map" size={18} color={t.BEIGE} />
        <Text style={styles.btnText}>Open the map</Text>
      </Pressable>
      <Pressable
        onPress={shareHouse}
        style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}
      >
        <Mark name="share" size={18} />
        <Text style={styles.btnGhostText}>Share the house</Text>
      </Pressable>
      <Row
        mark="menu"
        label="share the board"
        hint="the table QR · the public board"
        onPress={shareBoard}
      />
      <Row mark="instagram" label="Instagram" hint="@blancocoffeehouse" onPress={() => openAway(INSTAGRAM)} />
      <Row mark="pictures" label="the pictures" hint="In the app — the cup, the case, the room" onPress={onPictures} />
      <Row mark="site" label="the house site" hint="The public house on the web" onPress={() => openAway(HOUSE_SITE)} />
      {reviews && reviews.reviews.length ? (
        <>
          <Text style={styles.sectionTitle}>from the house.</Text>
          <Text style={styles.prose}>
            {reviews.rating ? reviews.rating.toFixed(1) + " · " : ""}
            {reviews.count ? reviews.count + " on Google" : "Google"}
          </Text>
          {reviews.reviews.map((row, index) => (
            <View key={row.author + String(index)} style={styles.order}>
              <Text style={styles.orderItems}>{row.text}</Text>
              <Text style={styles.orderStatus}>
                {row.author}
                {row.relativeTime ? " · " + row.relativeTime : ""}
              </Text>
            </View>
          ))}
          {reviews.url ? (
            <Row mark="google" label="Google reviews" hint="A few words, if you like" onPress={() => openAway(reviews.url)} />
          ) : null}
        </>
      ) : null}
      <Text style={styles.sectionTitle}>in the cup.</Text>
      <Text style={styles.prose}>
        Ask at the counter for allergens and how the milk goes. The board does not keep a full book on the phone.
      </Text>
      <Text style={styles.prose}>
        Collection at the house. Watch the bag for in, making it, and ready.
        Come to the counter when it’s up — we do not ping the phone.
      </Text>
    </ScrollView>
    </View>
  );
}

function SettingsScreen({
  name,
  email,
  handle,
  handlePicks,
  onSaveHandle,
  onMoreHandles,
  hours,
  stripe,
  prefs,
  onPrefs,
  bag,
  onKeepUsual,
  onClearUsual,
  onBoard,
  onSaveName,
  onSavePassword,
  passwordOn,
  onHouse,
  onBack,
  onSignOut
}: {
  name: string;
  email: string;
  handle: string;
  handlePicks: string[];
  onSaveHandle: (next: string) => Promise<void>;
  onMoreHandles: () => Promise<void>;
  hours: HouseHours | null;
  stripe: boolean;
  prefs: Prefs;
  onPrefs: (next: Prefs) => void;
  bag: Line[];
  onKeepUsual: (id: string, name: string, note?: string) => Promise<void>;
  onClearUsual: () => Promise<void>;
  onBoard: () => void;
  onSaveName: (next: string) => Promise<void>;
  onSavePassword: (current: string, next: string) => Promise<void>;
  passwordOn: boolean;
  onHouse: () => void;
  onBack: () => void;
  onSignOut: () => void;
}) {
  const { t, styles } = useStyles(makeStyles);
  const pad = usePad();
  const [called, setCalled] = useState(name);
  const [note, setNote] = useState(prefs.bagNote);
  const [currentPass, setCurrentPass] = useState("");
  const [nextPass, setNextPass] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCalled(name);
  }, [name]);

  useEffect(() => {
    setNote(prefs.bagNote);
  }, [prefs.bagNote]);

  async function keepHandle(next: string) {
    tap();
    setBusy(true);
    setStatus("");
    try {
      await onSaveHandle(next);
      ok();
      setStatus("In the house you’re " + next + ".");
    } catch (err) {
      warn();
      setStatus(err instanceof Error ? err.message : "That name could not be kept.");
    } finally {
      setBusy(false);
    }
  }

  async function moreNames() {
    tap();
    setBusy(true);
    setStatus("");
    try {
      await onMoreHandles();
    } catch (err) {
      warn();
      setStatus(err instanceof Error ? err.message : "More names could not come up.");
    } finally {
      setBusy(false);
    }
  }

  async function keepName() {
    const next = called.trim();
    if (!next) {
      warn();
      setStatus("The house needs a name to call.");
      return;
    }
    tap();
    setBusy(true);
    setStatus("");
    try {
      await onSaveName(next);
      ok();
      setStatus("The house will call you that.");
    } catch (err) {
      warn();
      setStatus(err instanceof Error ? err.message : "That name could not be kept.");
    } finally {
      setBusy(false);
    }
  }

  async function keepPrefs(next: Prefs) {
    const saved = await savePrefs(next);
    onPrefs(saved);
  }

  async function keepNote() {
    tap();
    await keepPrefs({ ...prefs, bagNote: note.trim() });
    ok();
    setStatus(
      hasUsual(prefs)
        ? "The usual note sits with the bag."
        : "The usual note sits in the bag."
    );
  }

  async function keepUsualFromBag(row: Line) {
    setBusy(true);
    setStatus("");
    try {
      await onKeepUsual(row.id, row.name, note.trim());
      setStatus("kept as the usual.");
    } catch {
      warn();
      setStatus("The usual could not be kept.");
    } finally {
      setBusy(false);
    }
  }

  async function letUsualGo() {
    tap();
    setBusy(true);
    setStatus("");
    try {
      await onClearUsual();
      setStatus("The usual is let go.");
    } catch {
      warn();
      setStatus("The usual could not be let go.");
    } finally {
      setBusy(false);
    }
  }

  async function keepPassword() {
    if (nextPass.trim().length < 8) {
      warn();
      setStatus("A new password needs at least eight characters.");
      return;
    }
    tap();
    setBusy(true);
    setStatus("");
    try {
      await onSavePassword(currentPass, nextPass);
      ok();
      setCurrentPass("");
      setNextPass("");
      setStatus("The door has a new password.");
    } catch (err) {
      warn();
      setStatus(err instanceof Error ? err.message : "That password could not be kept.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.sticky, { paddingTop: pad.top }]}>
        <Back label="you." onPress={onBack} />
        <Kicker label="settings" />
        <Text style={styles.title}>your way.</Text>
      </View>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenInner, { paddingTop: 14, paddingBottom: 36 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.prose}>
          In the house, others see a handle. Your name and email stay here, and with the desk when a collection needs them.
        </Text>

        <Text style={styles.label}>in the house</Text>
        <Text style={styles.fact}>{handle || "a member"}</Text>
        <Text style={styles.prose}>
          The house assigned this. Filter through the names if you want another.
        </Text>
        <View style={styles.seg}>
          {(handle ? [handle, ...handlePicks.filter((row) => row !== handle)] : handlePicks)
            .slice(0, 8)
            .map((row) => (
              <Pressable
                key={row}
                onPress={() => keepHandle(row)}
                disabled={busy}
                style={[
                  styles.segBtn,
                  handle === row && styles.segOn,
                  busy && styles.dim
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: handle === row }}
              >
                <Text style={[styles.segText, handle === row && styles.segTextOn]}>{row}</Text>
              </Pressable>
            ))}
        </View>
        <Pressable
          disabled={busy}
          onPress={moreNames}
          style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed, busy && styles.dim]}
        >
          <Text style={styles.btnGhostText}>{busy ? "one moment…" : "more names"}</Text>
        </Pressable>

        <Text style={styles.label}>for the counter</Text>
        <TextInput
          value={called}
          onChangeText={setCalled}
          placeholder="the name the counter calls"
          placeholderTextColor={t.MUTED}
          keyboardAppearance={t.night ? "dark" : "light"}
          autoCapitalize="words"
          autoCorrect={false}
          style={styles.input}
          maxLength={40}
        />
        <Text style={styles.prose}>Only you and the desk see this. It is not on today’s cups.</Text>
        <Pressable
          disabled={busy}
          onPress={keepName}
          style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed, busy && styles.dim]}
        >
          <Text style={styles.btnGhostText}>{busy ? "Keeping…" : "Keep this name"}</Text>
        </Pressable>

        <Text style={styles.label}>email</Text>
        <Text style={styles.fact}>{email || "—"}</Text>
        <Text style={styles.prose}>Stays with the sign-in. The desk uses it for the card and collections.</Text>
        {passwordOn ? (
          <>
            <Text style={styles.label}>password</Text>
            <TextInput
              value={currentPass}
              onChangeText={setCurrentPass}
              placeholder="current password"
              placeholderTextColor={t.MUTED}
              keyboardAppearance={t.night ? "dark" : "light"}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              style={styles.input}
            />
            <TextInput
              value={nextPass}
              onChangeText={setNextPass}
              placeholder="new password"
              placeholderTextColor={t.MUTED}
              keyboardAppearance={t.night ? "dark" : "light"}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              style={styles.input}
            />
            <Pressable
              disabled={busy || !currentPass || !nextPass}
              onPress={keepPassword}
              style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed, busy && styles.dim]}
            >
              <Text style={styles.btnGhostText}>{busy ? "Keeping…" : "Keep this password"}</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.prose}>Apple or Google keeps this door. There is no house password on this account.</Text>
        )}
        <Pressable
          onPress={() => {
            tap();
            openAway(ACCOUNT_URL);
          }}
          hitSlop={8}
        >
          <Text style={styles.link}>Change email on the house site</Text>
        </Pressable>

        <Text style={styles.label}>the usual</Text>
        <Text style={styles.fact}>{prefs.usualName || "nothing kept yet"}</Text>
        <Text style={styles.prose}>
          {hasUsual(prefs)
            ? "One tap from the board or you puts it in the bag."
            : "Add a cup to the bag, then keep it as the usual. Or hold a cup on the board."}
        </Text>
        {bag
          .filter((row) => row.id !== prefs.usualId)
          .map((row) => (
            <Pressable
              key={row.id}
              disabled={busy}
              onPress={() => keepUsualFromBag(row)}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.link}>
                {bag.length > 1
                  ? "keep " + row.name + " as the usual"
                  : "keep this as the usual"}
              </Text>
            </Pressable>
          ))}
        {hasUsual(prefs) ? (
          <Pressable
            disabled={busy}
            onPress={letUsualGo}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={styles.link}>let the usual go</Text>
          </Pressable>
        ) : null}
        {prefs.lastCups.length ? (
          <>
            <Text style={styles.label}>last cups</Text>
            <Text style={styles.fact}>
              {prefs.lastCups.map((cup) => cup.name).join(" · ")}
            </Text>
            <Text style={styles.prose}>From the house. One tap on you or the board puts a cup in the bag.</Text>
          </>
        ) : null}
        <Pressable
          onPress={() => {
            tap();
            onBoard();
          }}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text style={styles.link}>pick from the board</Text>
        </Pressable>

        <Text style={styles.label}>a note for the counter</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Oat milk, extra hot…"
          placeholderTextColor={t.MUTED}
          keyboardAppearance={t.night ? "dark" : "light"}
          style={styles.input}
          maxLength={140}
          onEndEditing={keepNote}
        />
        <Pressable onPress={keepNote} hitSlop={8}>
          <Text style={styles.link}>Keep this note</Text>
        </Pressable>

        <Text style={styles.label}>pay</Text>
        <Text style={styles.prose}>
          {stripe
            ? "Pay now with the card. It opens in Safari. Collection at the counter — not to the door. Delivery is still to come."
            : "The card is not open on this phone yet."}
        </Text>

        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleLabel}>the feel.</Text>
            <Text style={styles.rowHint}>A light tap when you add, pay, and move around.</Text>
          </View>
          <Switch
            value={prefs.haptics}
            onValueChange={(on) => {
              keepPrefs({ ...prefs, haptics: on }).then(() => {
                if (on) tap();
              });
            }}
            trackColor={{ false: t.LINE, true: t.BROWN }}
            thumbColor={t.BEIGE}
            ios_backgroundColor={t.LINE}
            accessibilityLabel="The feel"
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleLabel}>the night.</Text>
            <Text style={styles.rowHint}>The house after hours. Cream on espresso.</Text>
          </View>
          <Switch
            value={!!prefs.night}
            onValueChange={(on) => {
              keepPrefs({ ...prefs, night: on });
            }}
            trackColor={{ false: t.LINE, true: t.BROWN }}
            thumbColor={t.BEIGE}
            ios_backgroundColor={t.LINE}
            accessibilityLabel="The night"
          />
        </View>

        <Text style={styles.sectionTitle}>the house.</Text>
        <Row mark="map" label="Fiveways Parade" hint={houseOpenLine(hours)} onPress={onHouse} />
        <Row mark="site" label="the house site" hint="The public house — menu for everyone" onPress={() => openAway(HOUSE_SITE)} />

        <Text style={styles.sectionTitle}>about.</Text>
        <Text style={styles.prose}>
          blanco. 1.0 · the house on Fiveways Parade. The site is public. The app is the same house in the pocket. Collection at the counter.
        </Text>

        {status ? <Text style={styles.status}>{status}</Text> : null}

        <Pressable
          onPress={onSignOut}
          style={({ pressed }) => [styles.btnGhost, { marginTop: 28 }, pressed && styles.pressed]}
        >
          <Text style={styles.btnGhostText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Row({
  label,
  hint,
  mark,
  hot,
  onPress
}: {
  label: string;
  hint?: string;
  mark?: MarkName;
  hot?: boolean;
  onPress: () => void;
}) {
  const { t, styles } = useStyles(makeStyles);
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      {mark ? (
        <View style={styles.rowMark}>
          <Mark name={mark} on={hot && mark === "bag"} size={18} />
        </View>
      ) : null}
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={[styles.rowHint, hot && styles.rowHintHot]}>{hint}</Text> : null}
      </View>
      <Mark name="go" size={16} color={hot ? t.BROWN : t.MUTED} />
    </Pressable>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: t.BEIGE
  },
  screenInner: {
    paddingHorizontal: 22
  },
  sticky: {
    zIndex: 2,
    paddingHorizontal: 22,
    paddingBottom: 10,
    backgroundColor: t.BEIGE,
    borderBottomWidth: 1,
    borderBottomColor: t.LINE
  },
  title: {
    fontFamily: ROUND,
    fontSize: 40,
    letterSpacing: -1.2,
    color: t.BROWN,
    marginBottom: 8,
    textTransform: "lowercase",
    lineHeight: 42
  },
  hours: {
    fontFamily: SANS,
    fontSize: 15,
    color: t.MUTED,
    marginBottom: 12
  },
  openLine: {
    fontFamily: SERIF_ITALIC,
    fontSize: 18,
    color: t.BROWN,
    marginBottom: 8
  },
  stamp: {
    fontFamily: SERIF_ITALIC,
    fontSize: 22,
    color: t.BROWN,
    marginBottom: 8
  },
  notice: {
    fontFamily: SANS_MED,
    fontSize: 15,
    color: t.BROWN,
    marginBottom: 12
  },
  prose: {
    fontFamily: SANS,
    fontSize: 16,
    lineHeight: 24,
    color: t.MUTED,
    marginBottom: 12,
    maxWidth: 360
  },
  address: {
    fontFamily: SANS,
    fontSize: 16,
    lineHeight: 24,
    color: t.BROWN,
    marginTop: 8,
    marginBottom: 16
  },
  sectionTitle: {
    marginTop: 28,
    marginBottom: 10,
    fontFamily: ROUND,
    fontSize: 22,
    letterSpacing: -0.4,
    color: t.BROWN
  },
  lastCups: {
    marginTop: 6,
    marginBottom: 4
  },
  lastCupsWord: {
    marginTop: 12,
    marginBottom: 2,
    fontFamily: ROUND,
    fontSize: 20,
    letterSpacing: -0.4,
    color: t.BROWN
  },
  lastCup: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: t.LINE
  },
  lastCupName: {
    flex: 1,
    fontFamily: ROUND,
    fontSize: 20,
    letterSpacing: -0.4,
    color: t.BROWN
  },
  lastCupCue: {
    fontFamily: SANS_SEMI,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: t.MUTED
  },
  sectionFirst: {
    marginTop: 4
  },
  foldBlock: {
    marginTop: 8,
    marginBottom: 6
  },
  stampCard: {
    marginTop: 4,
    marginBottom: 6,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: t.PAPER,
    borderWidth: 1,
    borderColor: t.LINE,
    borderRadius: 18
  },
  stampCardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14
  },
  stampSeal: {
    width: 40,
    height: 40,
    borderRadius: 20
  },
  stampCardCopy: {
    flex: 1,
    minWidth: 0
  },
  stampWord: {
    fontFamily: SERIF_ITALIC,
    fontSize: 22,
    letterSpacing: -0.4,
    color: t.BROWN,
    lineHeight: 24
  },
  stampKicker: {
    marginTop: 2,
    fontFamily: SANS_MED,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: t.MUTED
  },
  stampCount: {
    fontFamily: ROUND,
    fontSize: 18,
    letterSpacing: -0.4,
    color: t.BROWN
  },
  stampGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10
  },
  stampCup: {
    width: "22%",
    aspectRatio: 1
  },
  stampNote: {
    marginTop: 12,
    fontFamily: SANS,
    fontSize: 14,
    lineHeight: 20,
    color: t.MUTED
  },
  order: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: t.LINE
  },
  orderStatus: {
    fontFamily: SANS_MED,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: t.MUTED,
    marginBottom: 4
  },
  orderItems: {
    fontFamily: SANS,
    fontSize: 16,
    color: t.BROWN,
    marginBottom: 4
  },
  orderNote: {
    marginTop: 6,
    fontFamily: SANS,
    fontSize: 14,
    lineHeight: 20,
    color: t.MUTED
  },
  historyRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: t.LINE
  },
  historyWhen: {
    fontFamily: SANS_MED,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: t.MUTED,
    marginBottom: 4
  },
  historyItems: {
    fontFamily: SERIF_ITALIC,
    fontSize: 18,
    color: t.BROWN,
    marginBottom: 4
  },
  historyTotal: {
    fontFamily: SANS,
    fontSize: 14,
    color: t.MUTED,
    fontVariant: ["tabular-nums"]
  },
  receiptPaper: {
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 18,
    paddingHorizontal: 16,
    backgroundColor: t.PAPER,
    borderWidth: 1,
    borderColor: t.LINE,
    borderRadius: 18
  },
  receiptHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14
  },
  receiptSeal: {
    width: 40,
    height: 40,
    borderRadius: 20
  },
  receiptPlace: {
    fontFamily: SANS,
    fontSize: 14,
    lineHeight: 20,
    color: t.MUTED,
    marginBottom: 4
  },
  receiptMeta: {
    fontFamily: SANS,
    fontSize: 14,
    lineHeight: 20,
    color: t.MUTED,
    marginBottom: 12
  },
  receiptLine: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 8
  },
  receiptName: {
    fontFamily: SANS_MED,
    fontSize: 15,
    color: t.BROWN,
    maxWidth: "62%"
  },
  receiptLeader: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: t.LINE,
    minWidth: 12,
    alignSelf: "center"
  },
  receiptPrice: {
    fontFamily: SANS,
    fontSize: 14,
    color: t.MUTED,
    fontVariant: ["tabular-nums"]
  },
  receiptTotalLabel: {
    fontFamily: SANS_SEMI,
    fontSize: 15,
    color: t.BROWN
  },
  receiptTotalPrice: {
    fontFamily: SANS_SEMI,
    fontSize: 15,
    color: t.BROWN,
    fontVariant: ["tabular-nums"]
  },
  receiptPaid: {
    marginTop: 8,
    fontFamily: SERIF_ITALIC,
    fontSize: 18,
    color: t.BROWN
  },
  receiptId: {
    marginTop: 6,
    fontFamily: SANS_MED,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: t.MUTED
  },
  rowPrice: {
    fontFamily: SANS_MED,
    fontSize: 14,
    color: t.BROWN,
    fontVariant: ["tabular-nums"]
  },
  input: {
    borderWidth: 1,
    borderColor: t.LINE,
    backgroundColor: t.PAPER,
    color: t.BROWN,
    fontFamily: SANS,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    borderRadius: 16,
    marginBottom: 8
  },
  label: {
    marginTop: 22,
    marginBottom: 8,
    fontFamily: SANS_MED,
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: t.MUTED
  },
  fact: {
    fontFamily: SANS,
    fontSize: 16,
    color: t.BROWN,
    marginBottom: 4
  },
  link: {
    marginTop: 4,
    fontFamily: SERIF_ITALIC,
    fontSize: 17,
    color: t.BROWN
  },
  status: {
    marginTop: 10,
    marginBottom: 8,
    fontFamily: SANS,
    fontSize: 15,
    color: t.BROWN
  },
  btnGhost: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: t.BROWN,
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
    color: t.BROWN,
    fontSize: 15,
    letterSpacing: 0.2
  },
  btn: {
    marginTop: 10,
    backgroundColor: t.BROWN,
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
    color: t.BEIGE,
    fontSize: 15,
    letterSpacing: 0.4
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }]
  },
  dim: {
    opacity: 0.45
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: t.LINE
  },
  rowCopy: {
    flex: 1,
    minWidth: 0
  },
  rowMark: {
    width: 28,
    alignItems: "center"
  },
  rowLabel: {
    fontFamily: ROUND,
    fontSize: 20,
    letterSpacing: -0.4,
    color: t.BROWN,
    textTransform: "lowercase"
  },
  rowHint: {
    marginTop: 4,
    fontFamily: SANS,
    fontSize: 13,
    lineHeight: 18,
    color: t.MUTED
  },
  rowHintHot: {
    color: t.BROWN
  },
  seg: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16
  },
  segBtn: {
    minWidth: "30%",
    flexGrow: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: t.BROWN,
    borderRadius: 16
  },
  segOn: {
    backgroundColor: t.BROWN
  },
  segText: {
    fontFamily: SANS_MED,
    fontSize: 14,
    color: t.BROWN
  },
  segTextOn: {
    color: t.BEIGE
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 28,
    paddingVertical: 8
  },
  toggleCopy: {
    flex: 1
  },
  toggleLabel: {
    fontFamily: ROUND,
    fontSize: 22,
    letterSpacing: -0.4,
    color: t.BROWN
  }
});
}

