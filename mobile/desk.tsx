import { Image } from "expo-image";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { ok, tap, warn } from "./feel";
import {
  HOUSE_TAGS,
  HOW_BUSY,
  HOW_WAIT,
  fetchDeskBoard,
  fetchDeskCups,
  fetchDeskOrders,
  fetchDeskRank,
  findDeskCard,
  formatPrice,
  giveDeskStamp,
  houseTags,
  orderItemsLine,
  pickupLine,
  postDeskRank,
  postDeskShot,
  saveDeskBoard,
  setDeskCup,
  setDeskOrder,
  type DeskCard,
  type DeskCup,
  type DeskDriver,
  type DeskHours,
  type DeskItem,
  type HouseOrder,
  type HouseTag,
  type Session
} from "./house";
import { Rise, useToTop } from "./motion";
import {
  ROUND,
  SANS,
  SANS_MED,
  SANS_SEMI,
  SERIF,
  SERIF_ITALIC,
  usePad,
  useStyles,
  type Palette
} from "./theme";
import { Back, FoldHead, Kicker } from "./ui";
import { StampCup } from "./stamp-cup";

const LANES = ["counter", "today", "card", "board", "visit"] as const;
type Lane = (typeof LANES)[number];

function ago(iso?: string) {
  if (!iso) return "";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!isFinite(min) || min < 1) return "just in";
  if (min === 1) return "1 min";
  if (min < 60) return min + " min";
  const hr = Math.floor(min / 60);
  return hr === 1 ? "1 hr" : hr + " hr";
}

function deskAdvance(status: string) {
  if (status === "in") return { status: "preparing", label: "Making it" };
  if (status === "preparing") return { status: "ready", label: "Ready" };
  if (status === "ready") return { status: "collected", label: "Collected" };
  return null;
}

function deskStage(status: string) {
  if (status === "preparing") return "making it";
  if (status === "ready") return "ready";
  return "in";
}

function deskLane(status: string) {
  if (status === "ready") return 0;
  if (status === "preparing") return 1;
  return 2;
}

function sortDeskOrders(orders: HouseOrder[]) {
  return orders.slice().sort((a, b) => {
    const lane = deskLane(a.status) - deskLane(b.status);
    if (lane) return lane;
    const aWhen = new Date(a.for_at || a.created_at || 0).getTime();
    const bWhen = new Date(b.for_at || b.created_at || 0).getTime();
    if (aWhen !== bWhen) return aWhen - bWhen;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });
}

function stampNote(card: DeskCard) {
  const name = card.name || "that member";
  if (card.filled) return "A drink on the house for " + name + ". The card starts again.";
  if (!card.stamps) {
    return (
      name +
      " has an empty card." +
      (card.cards_done ? " " + card.cards_done + " already on the house." : "")
    );
  }
  return name + " · " + card.stamps + " of 8.";
}

function groupDesk(items: DeskItem[]) {
  const sections: { title: string; items: DeskItem[] }[] = [];
  const map: Record<string, { title: string; items: DeskItem[] }> = {};
  items.forEach((item) => {
    const title =
      (item.board === "sweets" ? "sweets" : "drinks") +
      " · " +
      (item.section || "the board");
    if (!map[title]) {
      map[title] = { title, items: [] };
      sections.push(map[title]);
    }
    map[title].items.push(item);
  });
  return sections;
}

async function readShot() {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.82,
    base64: true,
    allowsEditing: false
  });
  if (picked.canceled || !picked.assets[0]) return "";
  const asset = picked.assets[0];
  let b64 = asset.base64 || "";
  if (!b64 && asset.uri) {
    b64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: "base64"
    });
  }
  if (!b64) return "";
  const mime =
    asset.mimeType === "image/png"
      ? "image/png"
      : asset.mimeType === "image/webp"
        ? "image/webp"
        : "image/jpeg";
  return "data:" + mime + ";base64," + b64;
}

export function DeskScreen({
  getSession,
  hoursBusy,
  hoursWait,
  onHowLive,
  onSavedBoard,
  onBack,
  topAt
}: {
  getSession: () => Promise<Session>;
  hoursBusy?: string;
  hoursWait?: string;
  onHowLive: (patch: { how_busy?: string; how_wait?: string }) => Promise<void>;
  onSavedBoard: () => void;
  onBack: () => void;
  topAt: number;
}) {
  const { t, styles } = useStyles(makeStyles);
  const pad = usePad();
  const list = useRef<ScrollView>(null);
  useToTop(topAt, list);
  const [lane, setLane] = useState<Lane>("counter");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<HouseOrder[]>([]);
  const [holds, setHolds] = useState<DeskCup[]>([]);
  const [cups, setCups] = useState<DeskCup[]>([]);
  const [email, setEmail] = useState("");
  const [card, setCard] = useState<DeskCard | null>(null);
  const [items, setItems] = useState<DeskItem[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const groups = useMemo(() => groupDesk(items), [items]);
  const [hoursForm, setHoursForm] = useState<DeskHours>({
    hours_line: "",
    hours_days: "",
    hours_range: "",
    opens: "11:00",
    closes: "20:00",
    notice: ""
  });
  const [rankCode, setRankCode] = useState("RANK-····");
  const [drivers, setDrivers] = useState<DeskDriver[]>([]);
  const [driverEmail, setDriverEmail] = useState("");
  const [shotKind, setShotKind] = useState<"house" | "cup" | "sweets">("house");
  const [shotCaption, setShotCaption] = useState("");
  const [paceBusy, setPaceBusy] = useState(false);

  async function loadLane(next = lane, pull = false) {
    if (pull) setRefreshing(true);
    try {
      const session = await getSession();
      if (next === "counter") {
        setOrders(await fetchDeskOrders(session));
        setStatus("");
      } else if (next === "today") {
        const board = await fetchDeskCups(session);
        setHolds(board.holds);
        setCups(board.cups);
        setStatus(
          board.holds.length
            ? board.holds.length === 1
              ? "one cup waiting."
              : board.holds.length + " cups waiting."
            : "no cups waiting."
        );
      } else if (next === "board" || next === "visit") {
        const board = await fetchDeskBoard(session);
        setItems(board.items);
        setHoursForm(board.settings);
        if (next === "visit") {
          const rank = await fetchDeskRank(session);
          setRankCode(rank.code);
          setDrivers(rank.drivers);
        }
        setStatus("");
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "the desk could not load.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadLane(lane);
  }, [lane]);

  useEffect(() => {
    if (lane !== "counter") return;
    const tick = setInterval(() => {
      loadLane("counter");
    }, 8000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") loadLane("counter");
    });
    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, [lane]);

  async function run(id: string, work: () => Promise<void>) {
    if (busy) return;
    tap();
    setBusy(id);
    try {
      await work();
      ok();
    } catch (err) {
      warn();
      setStatus(err instanceof Error ? err.message : "the desk could not take that.");
    } finally {
      setBusy("");
    }
  }

  const readyCount = orders.filter((order) => order.status === "ready").length;
  const makingCount = orders.filter((order) => order.status === "preparing").length;
  const counterLine = orders.length
    ? [
        readyCount ? (readyCount === 1 ? "one ready" : readyCount + " ready") : "",
        makingCount ? (makingCount === 1 ? "one making" : makingCount + " making") : "",
        orders.length === 1 ? "one collection." : orders.length + " collections."
      ]
        .filter(Boolean)
        .join(" · ")
    : "no collections waiting.";

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.sticky, { paddingTop: pad.top }]}>
        <Back label="you" onPress={onBack} />
        <Kicker label="the desk" />
        <Text style={styles.title}>the house desk.</Text>
        <View style={styles.lanes} accessibilityRole="tablist">
          {LANES.map((id) => {
            const on = lane === id;
            return (
              <Pressable
                key={id}
                onPress={() => {
                  if (on) return;
                  tap();
                  setLane(id);
                }}
                style={[styles.lane, on && styles.laneOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.laneText, on && styles.laneTextOn]}>{id}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <ScrollView
        ref={list}
        style={styles.screen}
        contentContainerStyle={[styles.inner, { paddingBottom: 36 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadLane(lane, true)} tintColor={t.BROWN} />
        }
      >
        <Rise key={lane} shift>
          {lane === "counter" ? (
            <>
              <Text style={styles.prose}>{counterLine} In, then making it, then ready. Collected when they take it.</Text>
              {!orders.length ? (
                <Text style={styles.empty}>the counter is clear.</Text>
              ) : (
                sortDeskOrders(orders).map((order) => {
                  const next = deskAdvance(order.status);
                  const who = order.name || order.email || "a member";
                  return (
                    <View key={order.id} style={[styles.ticket, order.status === "ready" && styles.ticketReady]}>
                      <Text style={styles.who}>
                        {who} · {ago(order.created_at)} · {deskStage(order.status)}
                        {order.rank ? " · rank" : ""}
                        {order.paid ? " · paid" : ""}
                      </Text>
                      <Text style={styles.items}>{orderItemsLine(order)}</Text>
                      <Text style={styles.note}>{pickupLine(order)}</Text>
                      {order.note ? <Text style={styles.note}>“{order.note}”</Text> : null}
                      <Text style={styles.price}>{formatPrice(order.total_gbp)}</Text>
                      <View style={styles.tools}>
                        {next ? (
                          <Pressable
                            onPress={() =>
                              run(order.id, async () => {
                                const session = await getSession();
                                await setDeskOrder(session, order.id, next.status);
                                await loadLane("counter");
                              })
                            }
                            disabled={busy === order.id}
                            style={({ pressed }) => [styles.btn, pressed && styles.pressed, busy === order.id && styles.dim]}
                            accessibilityRole="button"
                            accessibilityLabel={next.label}
                          >
                            <Text style={styles.btnText}>{next.label}</Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          onPress={() => {
                            Alert.alert(
                              "let this go?",
                              order.paid
                                ? "A paid card comes back. It comes off the counter."
                                : "It comes off the counter.",
                              [
                                { text: "stay", style: "cancel" },
                                {
                                  text: "let go",
                                  style: "destructive",
                                  onPress: () =>
                                    run(order.id + "-drop", async () => {
                                      const session = await getSession();
                                      await setDeskOrder(session, order.id, "cancelled");
                                      await loadLane("counter");
                                    })
                                }
                              ]
                            );
                          }}
                          style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}
                          accessibilityRole="button"
                          accessibilityLabel="Let this collection go"
                        >
                          <Text style={styles.btnGhostText}>Let go</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
            </>
          ) : null}

          {lane === "today" ? (
            <>
              <Text style={styles.prose}>
                A shot that isn’t clearly the house waits here. Put it up if it’s the cup, the case, or the room.
              </Text>
              {!holds.length && !cups.length ? (
                <Text style={styles.empty}>no cups on the desk.</Text>
              ) : null}
              {holds.map((cup) => (
                <CupRow
                  key={cup.id}
                  cup={cup}
                  waiting
                  busy={busy === cup.id}
                  onLive={() =>
                    run(cup.id, async () => {
                      const session = await getSession();
                      await setDeskCup(session, cup.id, "live");
                      await loadLane("today");
                    })
                  }
                  onDrop={() =>
                    run(cup.id + "-drop", async () => {
                      const session = await getSession();
                      await setDeskCup(session, cup.id, "drop");
                      await loadLane("today");
                    })
                  }
                />
              ))}
              {cups.length ? <Text style={styles.label}>on the board.</Text> : null}
              {cups.map((cup) => (
                <CupRow
                  key={cup.id}
                  cup={cup}
                  waiting={false}
                  busy={busy === cup.id}
                  onDrop={() =>
                    run(cup.id + "-drop", async () => {
                      const session = await getSession();
                      await setDeskCup(session, cup.id, "drop");
                      await loadLane("today");
                    })
                  }
                />
              ))}
            </>
          ) : null}

          {lane === "card" ? (
            <>
              <Text style={styles.prose}>Eight stamps. A drink on the house. Type the member email from their blanco account.</Text>
              <Text style={styles.label}>member email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="hello@…"
                placeholderTextColor={t.MUTED}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                keyboardAppearance={t.night ? "dark" : "light"}
                style={styles.input}
              />
              <View style={styles.tools}>
                <Pressable
                  onPress={() =>
                    run("find", async () => {
                      const session = await getSession();
                      const next = await findDeskCard(session, email.trim().toLowerCase());
                      setCard(next);
                      setStatus(stampNote(next));
                    })
                  }
                  style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}
                >
                  <Text style={styles.btnGhostText}>Find</Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    run("stamp", async () => {
                      const session = await getSession();
                      const next = await giveDeskStamp(session, (card?.email || email).trim().toLowerCase());
                      setCard(next);
                      setStatus(stampNote(next));
                    })
                  }
                  disabled={!card}
                  style={({ pressed }) => [
                    styles.btn,
                    pressed && styles.pressed,
                    !card && styles.dim
                  ]}
                >
                  <Text style={styles.btnText}>Give a stamp</Text>
                </Pressable>
              </View>
              {card ? (
                <View style={styles.stampRow} accessibilityLabel={card.stamps + " of 8 stamps"}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <View key={i} style={styles.stamp}>
                      <StampCup on={i < card.stamps} />
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}

          {lane === "board" ? (
            <>
              <Text style={styles.prose}>Mark sold out, a house tag, or a price. Save writes to the public menu.</Text>
              {groups.map((section, i) => {
                const fold = groups.length > 1;
                const on = !fold || (open[section.title] ?? i === 0);
                return (
                  <View key={section.title}>
                    <FoldHead
                      label={section.title}
                      count={section.items.length}
                      open={on}
                      onPress={() =>
                        setOpen((prev) => ({ ...prev, [section.title]: !on }))
                      }
                    />
                    {on
                      ? section.items.map((item) => (
                <View key={item.id || item.name} style={styles.line}>
                  <View style={styles.lineHead}>
                    <Text style={styles.lineName}>{item.name}</Text>
                    <Text style={styles.lineBoard}>{item.board}</Text>
                  </View>
                  <TextInput
                    value={String(item.price_gbp)}
                    onChangeText={(next) =>
                      setItems((rows) =>
                        rows.map((row) =>
                          row.id === item.id ? { ...row, price_gbp: Number(next) || 0 } : row
                        )
                      )
                    }
                    keyboardType="decimal-pad"
                    keyboardAppearance={t.night ? "dark" : "light"}
                    style={styles.priceInput}
                    accessibilityLabel={"Price for " + item.name}
                  />
                  <Pressable
                    onPress={() =>
                      setItems((rows) =>
                        rows.map((row) =>
                          row.id === item.id ? { ...row, sold_out: !row.sold_out } : row
                        )
                      )
                    }
                    style={[styles.chip, item.sold_out && styles.chipOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: item.sold_out }}
                  >
                    <Text style={[styles.chipText, item.sold_out && styles.chipTextOn]}>
                      {item.sold_out ? "sold" : "on"}
                    </Text>
                  </Pressable>
                  <View style={styles.tags}>
                    {HOUSE_TAGS.map((tag) => {
                      const on = houseTags(item).indexOf(tag) !== -1;
                      return (
                        <Pressable
                          key={tag}
                          onPress={() =>
                            setItems((rows) =>
                              rows.map((row) => {
                                if (row.id !== item.id) return row;
                                const next = on
                                  ? row.allergens.filter((name) => name !== tag)
                                  : row.allergens.concat(tag);
                                return { ...row, allergens: next as HouseTag[] };
                              })
                            )
                          }
                          style={[styles.chip, on && styles.chipOn]}
                        >
                          <Text style={[styles.chipText, on && styles.chipTextOn]}>{tag}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                      ))
                      : null}
                  </View>
                );
              })}
              <Pressable
                onPress={() =>
                  run("board", async () => {
                    const session = await getSession();
                    await saveDeskBoard(session, { items });
                    onSavedBoard();
                    setStatus("saved.");
                  })
                }
                style={({ pressed }) => [styles.btn, { marginTop: 18 }, pressed && styles.pressed]}
              >
                <Text style={styles.btnText}>Save the board</Text>
              </Pressable>
            </>
          ) : null}

          {lane === "visit" ? (
            <>
              <Text style={styles.prose}>Hours, the room, the rank, and a picture for the gallery.</Text>
              <Text style={styles.label}>opens</Text>
              <TextInput
                value={hoursForm.opens}
                onChangeText={(opens) => setHoursForm((row) => ({ ...row, opens }))}
                placeholder="11:00"
                placeholderTextColor={t.MUTED}
                keyboardAppearance={t.night ? "dark" : "light"}
                style={styles.input}
              />
              <Text style={styles.label}>closes</Text>
              <TextInput
                value={hoursForm.closes}
                onChangeText={(closes) => setHoursForm((row) => ({ ...row, closes }))}
                placeholder="20:00"
                placeholderTextColor={t.MUTED}
                keyboardAppearance={t.night ? "dark" : "light"}
                style={styles.input}
              />
              <Text style={styles.label}>the line</Text>
              <TextInput
                value={hoursForm.hours_line}
                onChangeText={(hours_line) => setHoursForm((row) => ({ ...row, hours_line }))}
                placeholder="Open every day · 11am–8pm"
                placeholderTextColor={t.MUTED}
                keyboardAppearance={t.night ? "dark" : "light"}
                style={styles.input}
              />
              <Text style={styles.label}>a line for today</Text>
              <TextInput
                value={hoursForm.notice}
                onChangeText={(notice) => setHoursForm((row) => ({ ...row, notice }))}
                placeholder="Optional — matcha is off."
                placeholderTextColor={t.MUTED}
                keyboardAppearance={t.night ? "dark" : "light"}
                style={styles.input}
              />
              <Pressable
                onPress={() =>
                  run("hours", async () => {
                    const session = await getSession();
                    await saveDeskBoard(session, { settings: hoursForm });
                    onSavedBoard();
                    setStatus("saved.");
                  })
                }
                style={({ pressed }) => [styles.btn, { marginTop: 14 }, pressed && styles.pressed]}
              >
                <Text style={styles.btnText}>Save hours</Text>
              </Pressable>
              <Text style={styles.label}>the room</Text>
              <View style={styles.seg}>
                {HOW_BUSY.map((row) => (
                  <Pressable
                    key={row.id}
                    onPress={() => {
                      setPaceBusy(true);
                      onHowLive({ how_busy: row.id }).finally(() => setPaceBusy(false));
                    }}
                    style={[styles.chip, hoursBusy === row.id && styles.chipOn, paceBusy && styles.dim]}
                  >
                    <Text style={[styles.chipText, hoursBusy === row.id && styles.chipTextOn]}>
                      {row.label}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => onHowLive({ how_busy: "" })}
                  style={[styles.chip, !hoursBusy && styles.chipOn]}
                >
                  <Text style={[styles.chipText, !hoursBusy && styles.chipTextOn]}>clear</Text>
                </Pressable>
              </View>
              <Text style={styles.label}>the counter</Text>
              <View style={styles.seg}>
                {HOW_WAIT.map((row) => (
                  <Pressable
                    key={row.id}
                    onPress={() => onHowLive({ how_wait: row.id })}
                    style={[styles.chip, hoursWait === row.id && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, hoursWait === row.id && styles.chipTextOn]}>
                      {row.label}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => onHowLive({ how_wait: "" })}
                  style={[styles.chip, !hoursWait && styles.chipOn]}
                >
                  <Text style={[styles.chipText, !hoursWait && styles.chipTextOn]}>clear</Text>
                </Pressable>
              </View>
              <Text style={styles.section}>the rank.</Text>
              <Text style={styles.prose}>House code {rankCode}</Text>
              <Pressable
                onPress={() =>
                  run("rotate", async () => {
                    const session = await getSession();
                    const data = await postDeskRank(session, { action: "rotate" });
                    if (data.code) setRankCode(String(data.code));
                    await loadLane("visit");
                  })
                }
                style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}
              >
                <Text style={styles.btnGhostText}>New code</Text>
              </Pressable>
              <Text style={styles.label}>driver email</Text>
              <TextInput
                value={driverEmail}
                onChangeText={setDriverEmail}
                placeholder="hello@…"
                placeholderTextColor={t.MUTED}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                keyboardAppearance={t.night ? "dark" : "light"}
                style={styles.input}
              />
              <Pressable
                onPress={() =>
                  run("rank-add", async () => {
                    const session = await getSession();
                    await postDeskRank(session, { action: "add", email: driverEmail.trim().toLowerCase() });
                    setDriverEmail("");
                    await loadLane("visit");
                  })
                }
                style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}
              >
                <Text style={styles.btnGhostText}>Put on the rank</Text>
              </Pressable>
              {drivers.map((driver) => (
                <View key={driver.id || driver.email} style={styles.driver}>
                  <Text style={styles.who}>
                    {driver.name || driver.email} · {driver.status === "in" ? "on" : "paused"}
                  </Text>
                  <Pressable
                    onPress={() =>
                      run(driver.email, async () => {
                        const session = await getSession();
                        await postDeskRank(session, {
                          action: driver.status === "in" ? "pause" : "in",
                          email: driver.email
                        });
                        await loadLane("visit");
                      })
                    }
                    hitSlop={8}
                  >
                    <Text style={styles.link}>{driver.status === "in" ? "pause" : "put on"}</Text>
                  </Pressable>
                </View>
              ))}
              <Text style={styles.section}>a picture for the house.</Text>
              <Text style={styles.prose}>From the camera roll. It sits on the gallery with the printed photographs.</Text>
              <View style={styles.seg}>
                {(["house", "cup", "sweets"] as const).map((kind) => (
                  <Pressable
                    key={kind}
                    onPress={() => setShotKind(kind)}
                    style={[styles.chip, shotKind === kind && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, shotKind === kind && styles.chipTextOn]}>
                      {kind === "house" ? "the house" : kind === "cup" ? "in the cup" : "sweets"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={shotCaption}
                onChangeText={setShotCaption}
                placeholder="A line under the shot."
                placeholderTextColor={t.MUTED}
                keyboardAppearance={t.night ? "dark" : "light"}
                style={styles.input}
              />
              <Pressable
                onPress={() =>
                  run("shot", async () => {
                    const image = await readShot();
                    if (!image) return;
                    const session = await getSession();
                    await postDeskShot(session, image, shotKind, shotCaption.trim());
                    setShotCaption("");
                    setStatus("on the gallery.");
                  })
                }
                style={({ pressed }) => [styles.btn, { marginTop: 12 }, pressed && styles.pressed]}
              >
                <Text style={styles.btnText}>Send to the gallery</Text>
              </Pressable>
            </>
          ) : null}

          {status ? <Text style={styles.status}>{status}</Text> : null}
        </Rise>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CupRow({
  cup,
  waiting,
  busy,
  onLive,
  onDrop
}: {
  cup: DeskCup;
  waiting: boolean;
  busy: boolean;
  onLive?: () => void;
  onDrop: () => void;
}) {
  const { styles } = useStyles(makeStyles);
  return (
    <View style={styles.cupRow}>
      <Image source={{ uri: cup.uri }} style={styles.cupShot} contentFit="cover" />
      <View style={styles.cupCopy}>
        <Text style={styles.who}>
          {cup.name} · {ago(cup.created_at)}
        </Text>
        <Text style={styles.note}>{waiting ? "waiting on the house." : "on the board."}</Text>
        <View style={styles.tools}>
          {onLive ? (
            <Pressable
              onPress={onLive}
              disabled={busy}
              style={({ pressed }) => [styles.btn, pressed && styles.pressed, busy && styles.dim]}
            >
              <Text style={styles.btnText}>Put it up</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onDrop}
            disabled={busy}
            style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}
          >
            <Text style={styles.btnGhostText}>Let go</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    screen: { flex: 1 },
    sticky: { paddingHorizontal: 22, paddingBottom: 10 },
    inner: { paddingHorizontal: 22, paddingTop: 8 },
    title: {
      fontFamily: SERIF_ITALIC,
      fontSize: 32,
      letterSpacing: -0.8,
      color: t.BROWN,
      marginBottom: 14,
      lineHeight: 36
    },
    lanes: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 4
    },
    lane: {
      borderWidth: 1,
      borderColor: t.LINE,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8
    },
    laneOn: {
      backgroundColor: t.BROWN,
      borderColor: t.BROWN
    },
    laneText: {
      fontFamily: SANS_MED,
      fontSize: 12,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: t.MUTED
    },
    laneTextOn: {
      color: t.BEIGE
    },
    prose: {
      fontFamily: SANS,
      fontSize: 15,
      lineHeight: 22,
      color: t.MUTED,
      marginBottom: 16
    },
    empty: {
      fontFamily: SERIF_ITALIC,
      fontSize: 20,
      color: t.BROWN,
      marginTop: 12
    },
    ticket: {
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: t.LINE
    },
    ticketReady: {
      borderLeftWidth: 3,
      borderLeftColor: t.BROWN,
      paddingLeft: 12
    },
    who: {
      fontFamily: SANS_MED,
      fontSize: 13,
      color: t.MUTED,
      marginBottom: 4
    },
    items: {
      fontFamily: SERIF,
      fontSize: 20,
      letterSpacing: -0.3,
      color: t.BROWN,
      lineHeight: 24
    },
    note: {
      fontFamily: SANS,
      fontSize: 14,
      color: t.MUTED,
      marginTop: 4
    },
    price: {
      fontFamily: ROUND,
      fontSize: 16,
      color: t.BROWN,
      marginTop: 8
    },
    tools: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12
    },
    btn: {
      backgroundColor: t.BROWN,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10,
      minHeight: 44,
      justifyContent: "center"
    },
    btnText: {
      fontFamily: ROUND,
      fontSize: 14,
      color: t.BEIGE
    },
    btnGhost: {
      borderWidth: 1,
      borderColor: t.LINE,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10,
      minHeight: 44,
      justifyContent: "center"
    },
    btnGhostText: {
      fontFamily: SANS_SEMI,
      fontSize: 14,
      color: t.BROWN
    },
    pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
    dim: { opacity: 0.45 },
    label: {
      fontFamily: SANS_MED,
      fontSize: 11,
      letterSpacing: 1.6,
      textTransform: "uppercase",
      color: t.MUTED,
      marginTop: 16,
      marginBottom: 8
    },
    input: {
      borderWidth: 1,
      borderColor: t.LINE,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: SANS,
      fontSize: 16,
      color: t.INK,
      backgroundColor: t.PAPER
    },
    stampRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 18
    },
    stamp: {
      width: "22%",
      aspectRatio: 1
    },
    line: {
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: t.LINE
    },
    lineHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 8
    },
    lineName: {
      fontFamily: SERIF,
      fontSize: 18,
      color: t.BROWN,
      flex: 1
    },
    lineBoard: {
      fontFamily: SANS_MED,
      fontSize: 11,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      color: t.MUTED
    },
    priceInput: {
      borderWidth: 1,
      borderColor: t.LINE,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontFamily: ROUND,
      fontSize: 16,
      color: t.BROWN,
      marginBottom: 8,
      maxWidth: 120
    },
    tags: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 8
    },
    chip: {
      borderWidth: 1,
      borderColor: t.LINE,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    chipOn: {
      backgroundColor: t.BROWN,
      borderColor: t.BROWN
    },
    chipText: {
      fontFamily: SANS_MED,
      fontSize: 12,
      color: t.MUTED
    },
    chipTextOn: {
      color: t.BEIGE
    },
    seg: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8
    },
    section: {
      fontFamily: SERIF,
      fontSize: 22,
      color: t.BROWN,
      marginTop: 28,
      marginBottom: 8,
      letterSpacing: -0.4
    },
    driver: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.LINE
    },
    link: {
      fontFamily: SANS_SEMI,
      fontSize: 14,
      color: t.BROWN
    },
    cupRow: {
      flexDirection: "row",
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: t.LINE
    },
    cupShot: {
      width: 72,
      height: 72,
      borderRadius: 12,
      backgroundColor: t.PAPER
    },
    cupCopy: { flex: 1, minWidth: 0 },
    status: {
      fontFamily: SANS,
      fontSize: 14,
      color: t.MUTED,
      marginTop: 18
    }
  });
}
