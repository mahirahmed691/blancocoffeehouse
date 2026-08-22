import { useEffect, useState } from "react";
import {
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
  formatPrice,
  fetchReviews,
  houseOpenLine,
  houseState,
  orderStatusLine,
  type HouseHours,
  type HouseOrder,
  type HouseReviews
} from "./house";
import {
  ACCOUNT_URL,
  HOUSE_ADDRESS,
  HOUSE_MAPS,
  HOUSE_POST,
  HOUSE_SITE,
  HOUSE_STREET,
  HOUSE_TOWN,
  INSTAGRAM,
  openAway
} from "./pieces";
import { savePrefs, type PayPref, type Prefs } from "./prefs";
import {
  BEIGE,
  BROWN,
  LINE,
  MUTED,
  PAPER,
  ROUND,
  SANS,
  SANS_MED,
  SERIF_ITALIC,
  usePad
} from "./theme";
import { Kicker } from "./ui";

export type YouPage = "home" | "house" | "settings";

type YouStackProps = {
  page: YouPage;
  onPage: (next: YouPage) => void;
  hours: HouseHours | null;
  name: string;
  email: string;
  stamps: number;
  cardsDone: number;
  orders: HouseOrder[];
  onRank: boolean;
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
  onPictures: () => void;
};

export function YouStack(props: YouStackProps) {
  if (props.page === "house") {
    return (
      <HouseVisit
        hours={props.hours}
        onBack={() => props.onPage("home")}
        onPictures={props.onPictures}
      />
    );
  }
  if (props.page === "settings") {
    return (
      <SettingsScreen
        name={props.name}
        email={props.email}
        hours={props.hours}
        stripe={props.stripe}
        prefs={props.prefs}
        onPrefs={props.onPrefs}
        onSaveName={props.onSaveName}
        onHouse={() => props.onPage("house")}
        onBack={() => props.onPage("home")}
        onSignOut={props.onSignOut}
      />
    );
  }
  return <YouHome {...props} />;
}

function YouHome({
  name,
  email,
  stamps,
  cardsDone,
  orders,
  onRank,
  rankNote,
  rankCode,
  refreshing,
  hours,
  onRankCode,
  onJoinRank,
  onRefresh,
  onPage,
  onPictures
}: YouStackProps) {
  const pad = usePad();
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const stampNote =
    stamps === 0 && cardsDone
      ? cardsDone === 1
        ? "A drink on the house, then a new card."
        : cardsDone + " drinks on the house so far."
      : stamps
        ? stamps + " of 8. A drink on the house at eight."
        : "Eight stamps. A drink on the house.";
  const openLine = houseOpenLine(hours);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenInner, { paddingTop: pad.top, paddingBottom: 36 }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BROWN} />
      }
      keyboardShouldPersistTaps="handled"
    >
      <Kicker label="member" />
      <Text style={styles.title}>{name ? name.toLowerCase() + "." : "you."}</Text>
      <Text style={styles.hours}>{email}</Text>
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

      <Text style={styles.sectionTitle}>stamps.</Text>
      <View style={styles.stamps}>
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={i} style={[styles.dot, i < stamps && styles.dotOn]} />
        ))}
      </View>
      <Text style={styles.prose}>{stampNote}</Text>

      <Text style={styles.sectionTitle}>collection.</Text>
      {!orders.length ? (
        <Text style={styles.prose}>Nothing at the counter yet.</Text>
      ) : (
        orders.map((order) => {
          const open = openOrder === order.id;
          return (
            <Pressable
              key={order.id}
              onPress={() => {
                tap();
                setOpenOrder(open ? null : order.id);
              }}
              style={styles.order}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
            >
              <Text style={styles.orderStatus}>{orderStatusLine(order)}</Text>
              <Text style={styles.orderItems}>
                {(order.items || [])
                  .map((row) => row.qty + " × " + row.name)
                  .join(" · ")}
              </Text>
              <Text style={styles.rowPrice}>{formatPrice(Number(order.total_gbp) || 0)}</Text>
              {open && order.note ? (
                <Text style={styles.orderNote}>“{order.note}”</Text>
              ) : null}
              {open ? (
                <Text style={styles.orderNote}>
                  {order.paid ? "Paid." : "Pay when you collect."} Collection at the counter — not to the door.
                </Text>
              ) : null}
            </Pressable>
          );
        })
      )}

      <Text style={styles.sectionTitle}>the rank.</Text>
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
            placeholderTextColor="rgba(80,57,49,0.4)"
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

      <Text style={styles.sectionTitle}>the house.</Text>
      <Row
        label="Fiveways Parade"
        hint={openLine}
        onPress={() => onPage("house")}
      />
      <Row
        label="the pictures"
        hint="the house, in pictures"
        onPress={onPictures}
      />
      <Row
        label="settings"
        hint="Your name, the usual note, the card"
        onPress={() => onPage("settings")}
      />
    </ScrollView>
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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenInner, { paddingTop: pad.top, paddingBottom: 36 }]}
    >
      <Pressable
        onPress={() => {
          tap();
          onBack();
        }}
        hitSlop={12}
        accessibilityRole="button"
      >
        <Text style={styles.back}>you.</Text>
      </Pressable>
      <Kicker label="visit" />
      <Text style={styles.title}>the house.</Text>
      <Text style={styles.stamp}>{openWord}</Text>
      <Text style={styles.prose}>
        {(hours?.hours_days || "Monday–Sunday") + " · " + (hours?.hours_range || "11am–8pm")}
      </Text>
      {hours?.hours_line ? <Text style={styles.hours}>{hours.hours_line}</Text> : null}
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
          openAway(HOUSE_MAPS);
        }}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      >
        <Text style={styles.btnText}>Open the map</Text>
      </Pressable>
      <Pressable
        onPress={shareHouse}
        style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}
      >
        <Text style={styles.btnGhostText}>Share the house</Text>
      </Pressable>
      <Row label="Instagram" hint="@blancocoffeehouse" onPress={() => openAway(INSTAGRAM)} />
      <Row label="the pictures" hint="In the app — the cup, the case, the room" onPress={onPictures} />
      <Row label="the house site" hint="The public house on the web" onPress={() => openAway(HOUSE_SITE)} />
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
            <Row label="Google reviews" hint="A few words, if you like" onPress={() => openAway(reviews.url)} />
          ) : null}
        </>
      ) : null}
      <Text style={styles.sectionTitle}>in the cup.</Text>
      <Text style={styles.prose}>
        Ask at the counter for allergens and how the milk goes. The board does not keep a full book on the phone.
      </Text>
      <Text style={styles.prose}>
        Collection at the house. The counter will call your name — we do not ping the phone yet.
      </Text>
    </ScrollView>
  );
}

function SettingsScreen({
  name,
  email,
  hours,
  stripe,
  prefs,
  onPrefs,
  onSaveName,
  onHouse,
  onBack,
  onSignOut
}: {
  name: string;
  email: string;
  hours: HouseHours | null;
  stripe: boolean;
  prefs: Prefs;
  onPrefs: (next: Prefs) => void;
  onSaveName: (next: string) => Promise<void>;
  onHouse: () => void;
  onBack: () => void;
  onSignOut: () => void;
}) {
  const pad = usePad();
  const [called, setCalled] = useState(name);
  const [note, setNote] = useState(prefs.bagNote);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const payOn = !stripe && prefs.pay === "stripe" ? "ask" : prefs.pay;

  useEffect(() => {
    setCalled(name);
  }, [name]);

  useEffect(() => {
    setNote(prefs.bagNote);
  }, [prefs.bagNote]);

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
    setStatus("The usual note sits in the bag.");
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenInner, { paddingTop: pad.top, paddingBottom: 36 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => {
            tap();
            onBack();
          }}
          hitSlop={12}
          accessibilityRole="button"
        >
          <Text style={styles.back}>you.</Text>
        </Pressable>
        <Kicker label="settings" />
        <Text style={styles.title}>your way.</Text>
        <Text style={styles.prose}>
          How the house calls you, and how the bag usually goes. Email stays with the sign-in.
        </Text>

        <Text style={styles.label}>how you’re called</Text>
        <TextInput
          value={called}
          onChangeText={setCalled}
          placeholder="your name"
          placeholderTextColor="rgba(80,57,49,0.4)"
          autoCapitalize="words"
          autoCorrect={false}
          style={styles.input}
          maxLength={40}
        />
        <Pressable
          disabled={busy}
          onPress={keepName}
          style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed, busy && styles.dim]}
        >
          <Text style={styles.btnGhostText}>{busy ? "Keeping…" : "Keep this name"}</Text>
        </Pressable>

        <Text style={styles.label}>email</Text>
        <Text style={styles.fact}>{email || "—"}</Text>
        <Pressable
          onPress={() => {
            tap();
            openAway(ACCOUNT_URL);
          }}
          hitSlop={8}
        >
          <Text style={styles.link}>Change email or password on the house site</Text>
        </Pressable>

        <Text style={styles.label}>a usual note for the counter</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Oat milk, extra hot…"
          placeholderTextColor="rgba(80,57,49,0.4)"
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
            ? "Card now, or at the counter when you collect. Delivery is still to come."
            : "Pay at the counter when you collect. The card is not open on this phone yet."}
        </Text>
        <View style={styles.seg}>
          {(
            [
              ["ask", "ask"],
              ...(stripe ? [["stripe", "card"]] : []),
              ["counter", "counter"]
            ] as [PayPref, string][]
          ).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => {
                tap();
                keepPrefs({ ...prefs, pay: id });
              }}
              style={[styles.segBtn, payOn === id && styles.segOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: payOn === id }}
            >
              <Text style={[styles.segText, payOn === id && styles.segTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

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
            trackColor={{ false: "rgba(80,57,49,0.18)", true: BROWN }}
            thumbColor={BEIGE}
            ios_backgroundColor="rgba(80,57,49,0.18)"
            accessibilityLabel="The feel"
          />
        </View>

        <Text style={styles.sectionTitle}>the house.</Text>
        <Row label="Fiveways Parade" hint={houseOpenLine(hours)} onPress={onHouse} />
        <Row label="the house site" hint="The public house — menu for everyone" onPress={() => openAway(HOUSE_SITE)} />

        <Text style={styles.sectionTitle}>about.</Text>
        <Text style={styles.prose}>
          blanco. 1.0 · the house on Fiveways Parade. The site is public. The app is the same house in the pocket. Collection at the counter. Not on the App Store yet.
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
  onPress
}: {
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Text style={styles.rowGo}>open</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  back: {
    fontFamily: SERIF_ITALIC,
    fontSize: 18,
    color: BROWN,
    marginBottom: 12
  },
  hours: {
    fontFamily: SANS,
    fontSize: 15,
    color: MUTED,
    marginBottom: 12
  },
  openLine: {
    fontFamily: SERIF_ITALIC,
    fontSize: 18,
    color: BROWN,
    marginBottom: 8
  },
  stamp: {
    fontFamily: SERIF_ITALIC,
    fontSize: 22,
    color: BROWN,
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
    lineHeight: 24,
    color: MUTED,
    marginBottom: 12,
    maxWidth: 360
  },
  address: {
    fontFamily: SANS,
    fontSize: 16,
    lineHeight: 24,
    color: BROWN,
    marginTop: 8,
    marginBottom: 16
  },
  sectionTitle: {
    marginTop: 28,
    marginBottom: 10,
    fontFamily: ROUND,
    fontSize: 22,
    letterSpacing: -0.4,
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
  orderNote: {
    marginTop: 6,
    fontFamily: SANS,
    fontSize: 14,
    lineHeight: 20,
    color: MUTED
  },
  rowPrice: {
    fontFamily: SANS_MED,
    fontSize: 14,
    color: BROWN,
    fontVariant: ["tabular-nums"]
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
  label: {
    marginTop: 22,
    marginBottom: 8,
    fontFamily: SANS_MED,
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: MUTED
  },
  fact: {
    fontFamily: SANS,
    fontSize: 16,
    color: BROWN,
    marginBottom: 4
  },
  link: {
    marginTop: 4,
    fontFamily: SERIF_ITALIC,
    fontSize: 17,
    color: BROWN
  },
  status: {
    marginTop: 10,
    marginBottom: 8,
    fontFamily: SANS,
    fontSize: 15,
    color: BROWN
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
    borderBottomColor: LINE
  },
  rowCopy: {
    flex: 1,
    minWidth: 0
  },
  rowLabel: {
    fontFamily: ROUND,
    fontSize: 20,
    letterSpacing: -0.4,
    color: BROWN,
    textTransform: "lowercase"
  },
  rowHint: {
    marginTop: 4,
    fontFamily: SANS,
    fontSize: 13,
    lineHeight: 18,
    color: MUTED
  },
  rowGo: {
    fontFamily: SERIF_ITALIC,
    fontSize: 16,
    color: BROWN
  },
  seg: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8
  },
  segBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: BROWN,
    borderRadius: 999
  },
  segOn: {
    backgroundColor: BROWN
  },
  segText: {
    fontFamily: SANS_MED,
    fontSize: 14,
    color: BROWN
  },
  segTextOn: {
    color: BEIGE
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
    color: BROWN
  }
});
