import { Image } from "expo-image";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { type ReactNode, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { ok, tap, warn } from "./feel";
import {
  dropCheckin,
  fetchCheckins,
  postCheckin,
  type CupBoard,
  type CupCheckin,
  type Session
} from "./house";
import { INSTAGRAM, openAway, PIECES, type Piece } from "./pieces";
import { filterShots, fetchShots, type LookBoard, type Shot, type ShotKind } from "./shots";
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
import { Rise } from "./motion";
import { Back, Kicker, Mark, Stick } from "./ui";

type Filter = "all" | ShotKind;

export function LookScreen({
  board,
  onBoard,
  piece,
  onOpen,
  onBackPiece,
  getSession
}: {
  board: LookBoard;
  onBoard: (next: LookBoard) => void;
  piece: Piece | null;
  onOpen: (piece: Piece) => void;
  onBackPiece: () => void;
  getSession: () => Promise<Session>;
}) {
  if (piece) return <PieceView piece={piece} onBack={onBackPiece} />;
  return (
    <Rise key={board} shift={false} style={styles.screen}>
      {board === "pictures" ? (
        <Pictures onBoard={onBoard} />
      ) : board === "today" ? (
        <Today onBoard={onBoard} getSession={getSession} />
      ) : (
        <Wear onBoard={onBoard} onOpen={onOpen} />
      )}
    </Rise>
  );
}

function LookHead({
  board,
  onBoard,
  title,
  children
}: {
  board: LookBoard;
  onBoard: (next: LookBoard) => void;
  title: string;
  children?: ReactNode;
}) {
  return (
    <>
      <Kicker label="look" />
      <Text style={styles.title}>{title}</Text>
      <Stick
        value={board}
        options={["pictures", "today", "wear"] as const}
        onChange={onBoard}
      />
      {children}
    </>
  );
}

function Pictures({ onBoard }: { onBoard: (next: LookBoard) => void }) {
  const pad = usePad();
  const { width } = useWindowDimensions();
  const [shots, setShots] = useState<Shot[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const tile = (width - 44 - 10) / 2;
  const shown = filterShots(shots, filter);
  const current = shown.findIndex((shot) => shot.id === open);
  const viewing = current >= 0 ? shown[current] : null;

  async function load() {
    setError("");
    setLoading(true);
    try {
      setShots(await fetchShots());
    } catch {
      setError("The pictures could not load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function show(id: string) {
    tap();
    setOpen(id);
  }

  function step(delta: number) {
    if (current < 0) return;
    const next = shown[current + delta];
    if (!next) return;
    tap();
    setOpen(next.id);
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.sticky, { paddingTop: pad.top }]}>
        <LookHead
          board="pictures"
          onBoard={onBoard}
          title="the house, in pictures."
        >
          <View style={styles.filterRow}>
            {(["all", "cup", "sweets", "house"] as const).map((id) => (
              <Pressable
                key={id}
                onPress={() => {
                  tap();
                  setFilter(id);
                  setOpen(null);
                }}
                style={[styles.filterBtn, filter === id && styles.segOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === id }}
              >
                <Text style={[styles.filterText, filter === id && styles.segTextOn]}>
                  {id === "all" ? "all" : id === "cup" ? "in the cup" : id}
                </Text>
              </Pressable>
            ))}
          </View>
        </LookHead>
      </View>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenInner, { paddingTop: 14, paddingBottom: 28 }]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={BROWN} />
        }
      >
        <Text style={styles.prose}>
          Photographs from Fiveways Parade — the cup, the case, and the room. New shots from the desk sit with the rest.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading && !shown.length && !error ? (
          <Text style={styles.prose}>The pictures are coming up.</Text>
        ) : null}
        {!loading && !shown.length ? (
          <Text style={styles.prose}>The pictures are quiet. Pull to try again.</Text>
        ) : null}
        <View style={styles.grid}>
          {shown.map((shot) => (
            <Pressable
              key={shot.id}
              onPress={() => show(shot.id)}
              style={({ pressed }) => [
                styles.tile,
                { width: tile, height: tile * 1.4 },
                pressed && styles.pressed
              ]}
              accessibilityRole="button"
              accessibilityLabel={shot.alt}
            >
              <Image
                source={shot.uri}
                style={styles.tileImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={shot.id}
              />
              {shot.added ? <Text style={styles.added}>{shot.added}</Text> : null}
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => openAway(INSTAGRAM)}
          style={({ pressed }) => [styles.btn, { marginTop: 22 }, pressed && styles.pressed]}
        >
          <Mark name="instagram" size={18} color={BEIGE} />
          <Text style={styles.btnText}>Follow on Instagram</Text>
        </Pressable>
      </ScrollView>
      {viewing ? (
        <View style={[styles.viewer, { paddingTop: pad.top }]}>
          <Back label="the pictures" onPress={() => setOpen(null)} />
          <View style={styles.viewerFrame}>
            <Image
              source={viewing.uri}
              style={styles.viewerImage}
              contentFit="contain"
              cachePolicy="memory-disk"
              recyclingKey={viewing.id}
              accessibilityLabel={viewing.alt}
            />
          </View>
          <Text style={styles.viewerAlt}>{viewing.alt}</Text>
          {viewing.added ? <Text style={styles.hours}>{viewing.added}</Text> : null}
          <View style={styles.viewerNav}>
            <Pressable
              onPress={() => step(-1)}
              disabled={current <= 0}
              hitSlop={10}
              style={current <= 0 ? styles.dim : undefined}
            >
              <Text style={styles.link}>last</Text>
            </Pressable>
            <Text style={styles.count}>
              {current + 1} / {shown.length}
            </Text>
            <Pressable
              onPress={() => step(1)}
              disabled={current >= shown.length - 1}
              hitSlop={10}
              style={current >= shown.length - 1 ? styles.dim : undefined}
            >
              <Text style={styles.link}>next</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const PICK: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [3, 4],
  quality: 0.55,
  base64: true,
  exif: false,
  ...(ImagePicker.UIImagePickerPreferredAssetRepresentationMode
    ? {
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible
      }
    : {})
};

async function dataUrlFromAsset(asset: ImagePicker.ImagePickerAsset) {
  let b64 = asset.base64 || "";
  if (!b64 && asset.uri) {
    b64 = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: "base64"
    });
  }
  if (!b64) throw new Error("that picture could not go up.");
  const mime =
    asset.mimeType === "image/png"
      ? "image/png"
      : asset.mimeType === "image/webp"
        ? "image/webp"
        : "image/jpeg";
  const url = "data:" + mime + ";base64," + b64;
  if (url.length > 2.6 * 1024 * 1024) {
    throw new Error("that picture is too heavy. try a closer shot.");
  }
  return url;
}

function Today({
  onBoard,
  getSession
}: {
  onBoard: (next: LookBoard) => void;
  getSession: () => Promise<Session>;
}) {
  const pad = usePad();
  const { width } = useWindowDimensions();
  const [board, setBoard] = useState<CupBoard>({ today: "", mine: null, cups: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const tile = (width - 44 - 10) / 2;
  const cups = board.cups;
  const shown = open ? cups : [];
  const current = shown.findIndex((cup) => cup.id === open);
  const viewing = current >= 0 ? shown[current] : null;

  async function load() {
    setError("");
    setLoading(true);
    try {
      setBoard(await fetchCheckins(await getSession()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The cups could not load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function show(id: string) {
    tap();
    setOpen(id);
  }

  function step(delta: number) {
    if (current < 0) return;
    const next = shown[current + delta];
    if (!next) return;
    tap();
    setOpen(next.id);
  }

  async function pick(from: "camera" | "roll") {
    if (busy) return;
    tap();
    if (board.mine) {
      Alert.alert("replace your cup?", "this takes the place of the one already in. it stays up for 24 hours.", [
        { text: "stay", style: "cancel" },
        { text: "replace", onPress: () => send(from) }
      ]);
      return;
    }
    send(from);
  }

  async function send(from: "camera" | "roll") {
    setBusy(true);
    setError("");
    try {
      if (from === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setError("the camera is off for blanco.");
          return;
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setError("the roll is off for blanco.");
          return;
        }
      }
      const result =
        from === "camera"
          ? await ImagePicker.launchCameraAsync(PICK)
          : await ImagePicker.launchImageLibraryAsync(PICK);
      if (result.canceled) return;
      const asset = result.assets && result.assets[0];
      if (!asset) {
        setError("that picture could not go up.");
        return;
      }
      await postCheckin(await getSession(), await dataUrlFromAsset(asset));
      ok();
      setOpen(null);
      setBoard(await fetchCheckins(await getSession()));
    } catch (err) {
      warn();
      const message = err instanceof Error ? err.message : "that picture could not go up.";
      setError(
        /native module|ExponentImagePicker|cannot find/i.test(message)
          ? "this phone build cannot take a picture yet."
          : message
      );
    } finally {
      setBusy(false);
    }
  }

  function letGo(cup: CupCheckin) {
    if (!cup.mine || busy) return;
    Alert.alert("let this cup go?", "it comes off the board.", [
      { text: "stay", style: "cancel" },
      {
        text: "let go",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          setError("");
          try {
            await dropCheckin(await getSession(), cup.id);
            ok();
            setOpen(null);
            setBoard(await fetchCheckins(await getSession()));
          } catch (err) {
            warn();
            setError(err instanceof Error ? err.message : "that cup could not come off.");
          } finally {
            setBusy(false);
          }
        }
      }
    ]);
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.sticky, { paddingTop: pad.top }]}>
        <LookHead board="today" onBoard={onBoard} title="today.">
          <View style={styles.btnRow}>
            <Pressable
              onPress={() => pick("camera")}
              disabled={busy}
              style={({ pressed }) => [
                styles.btnHalf,
                busy && styles.dim,
                pressed && styles.pressed
              ]}
              accessibilityRole="button"
              accessibilityLabel="check in with the camera"
            >
              <Mark name="camera" size={18} color={BEIGE} />
              <Text style={styles.btnText}>{busy ? "going up" : "camera"}</Text>
            </Pressable>
            <Pressable
              onPress={() => pick("roll")}
              disabled={busy}
              style={({ pressed }) => [
                styles.btnHalfGhost,
                busy && styles.dim,
                pressed && styles.pressed
              ]}
              accessibilityRole="button"
              accessibilityLabel="check in from the camera roll"
            >
              <Mark name="roll" size={18} />
              <Text style={styles.btnGhostText}>the roll</Text>
            </Pressable>
          </View>
        </LookHead>
      </View>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenInner, { paddingTop: 14, paddingBottom: 28 }]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={BROWN} />
        }
      >
        <Text style={styles.prose}>
          your cup, with the house. it stays on the board for 24 hours — put another up and it takes the place of the last.
        </Text>
        {board.mine ? (
          <Text style={styles.hours}>you’re in.</Text>
        ) : (
          <Text style={styles.hours}>not in yet.</Text>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading && !cups.length && !error ? (
          <Text style={styles.prose}>the cups are coming up.</Text>
        ) : null}
        {!loading && !cups.length && !error ? (
          <Text style={styles.prose}>no cups in yet. put yours up.</Text>
        ) : null}
        {cups.length ? (
          <>
            <Text style={styles.closing}>in now.</Text>
            <CupGrid cups={cups} tile={tile} onOpen={show} />
          </>
        ) : null}
      </ScrollView>
      {viewing ? (
        <View style={[styles.viewer, { paddingTop: pad.top }]}>
          <Back label="today" onPress={() => setOpen(null)} />
          <View style={styles.viewerFrame}>
            <Image
              source={{ uri: viewing.uri }}
              style={styles.viewerImage}
              contentFit="cover"
              accessibilityLabel={viewing.name + "’s cup"}
            />
          </View>
          <Text style={styles.viewerAlt}>{viewing.name}</Text>
          {viewing.mine ? (
            <Pressable
              onPress={() => letGo(viewing)}
              disabled={busy}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.link}>let go</Text>
            </Pressable>
          ) : null}
          <View style={styles.viewerNav}>
            <Pressable
              onPress={() => step(-1)}
              disabled={current <= 0}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={[styles.link, current <= 0 && styles.dim]}>back</Text>
            </Pressable>
            <Text style={styles.count}>
              {current + 1} / {shown.length}
            </Text>
            <Pressable
              onPress={() => step(1)}
              disabled={current >= shown.length - 1}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={[styles.link, current >= shown.length - 1 && styles.dim]}>next</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function CupGrid({
  cups,
  tile,
  onOpen
}: {
  cups: CupCheckin[];
  tile: number;
  onOpen: (id: string) => void;
}) {
  return (
    <View style={styles.grid}>
      {cups.map((cup) => (
        <Pressable
          key={cup.id}
          onPress={() => onOpen(cup.id)}
          style={({ pressed }) => [
            styles.tile,
            { width: tile, height: tile * 1.2 },
            pressed && styles.pressed
          ]}
          accessibilityRole="button"
          accessibilityLabel={cup.name + "’s cup"}
        >
          <Image source={{ uri: cup.uri }} style={styles.tileImage} contentFit="cover" />
          <Text style={styles.added}>{cup.mine ? "you" : cup.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Wear({
  onBoard,
  onOpen
}: {
  onBoard: (next: LookBoard) => void;
  onOpen: (piece: Piece) => void;
}) {
  const pad = usePad();
  return (
    <View style={styles.screen}>
      <View style={[styles.sticky, { paddingTop: pad.top }]}>
        <LookHead board="wear" onBoard={onBoard} title="wear blanco." />
      </View>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenInner, { paddingTop: 14, paddingBottom: 28 }]}
      >
        <Text style={styles.prose}>
          The geometric b. on a tee, a hoodie, a tote — and the coffee club shirt already behind the counter. Not in the shop yet.
        </Text>
        <Text style={styles.closing}>blanco. your way. on you.</Text>
      <View style={styles.wearGrid}>
        {PIECES.map((piece) => (
          <Pressable
            key={piece.id}
            onPress={() => {
              tap();
              onOpen(piece);
            }}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={piece.alt}
          >
            <View style={styles.cardFrame}>
              <Image source={piece.source} style={styles.cardImage} contentFit="cover" />
            </View>
            <Text style={styles.cardName}>{piece.name}</Text>
            <Text style={styles.cardLine}>{piece.line}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={() => openAway(INSTAGRAM)}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      >
        <Mark name="instagram" size={18} color={BEIGE} />
        <Text style={styles.btnText}>Follow the drop</Text>
      </Pressable>
    </ScrollView>
    </View>
  );
}

function PieceView({ piece, onBack }: { piece: Piece; onBack: () => void }) {
  const pad = usePad();
  return (
    <View style={[styles.piece, { paddingTop: pad.top, paddingBottom: 16 }]}>
      <Back label="wear" onPress={onBack} />
      <View style={styles.pieceFrame}>
        <Image
          source={piece.source}
          style={styles.pieceImage}
          contentFit="cover"
          accessibilityLabel={piece.alt}
        />
      </View>
      <Text style={styles.pieceName}>{piece.name}</Text>
      <Text style={styles.pieceLine}>{piece.line}</Text>
      <Pressable
        onPress={() => openAway(INSTAGRAM)}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      >
        <Mark name="instagram" size={18} color={BEIGE} />
        <Text style={styles.btnText}>Follow the drop</Text>
      </Pressable>
    </View>
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
  sticky: {
    zIndex: 2,
    paddingHorizontal: 22,
    paddingBottom: 10,
    backgroundColor: BEIGE,
    borderBottomWidth: 1,
    borderBottomColor: LINE
  },
  title: {
    fontFamily: ROUND,
    fontSize: 40,
    letterSpacing: -1.2,
    color: BROWN,
    marginBottom: 8,
    textTransform: "lowercase",
    lineHeight: 42
  },
  prose: {
    fontFamily: SANS,
    fontSize: 16,
    lineHeight: 24,
    color: MUTED,
    marginBottom: 16,
    maxWidth: 360
  },
  hours: {
    fontFamily: SANS,
    fontSize: 15,
    color: MUTED,
    marginBottom: 8
  },
  closing: {
    fontFamily: SERIF_ITALIC,
    fontSize: 20,
    color: BROWN,
    marginBottom: 18
  },
  error: {
    marginBottom: 12,
    fontFamily: SANS,
    color: BROWN
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10
  },
  filterBtn: {
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: BROWN,
    borderRadius: 16
  },
  segOn: {
    backgroundColor: BROWN
  },
  filterText: {
    fontFamily: SANS_MED,
    fontSize: 13,
    color: BROWN
  },
  segTextOn: {
    color: BEIGE
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10
  },
  tile: {
    overflow: "hidden",
    backgroundColor: PAPER,
    borderWidth: 1,
    borderColor: LINE
  },
  tileImage: {
    width: "100%",
    height: "100%"
  },
  added: {
    position: "absolute",
    left: 8,
    bottom: 8,
    fontFamily: SANS_MED,
    fontSize: 11,
    color: BEIGE,
    backgroundColor: BROWN,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden"
  },
  wearGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12
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
  btnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10
  },
  btnHalf: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    backgroundColor: BROWN,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16
  },
  btnHalfGhost: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    backgroundColor: "transparent",
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BROWN
  },
  btnGhostText: {
    fontFamily: SANS_MED,
    color: BROWN,
    fontSize: 15,
    letterSpacing: 0.2
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
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }]
  },
  dim: {
    opacity: 0.35
  },
  piece: {
    flex: 1,
    backgroundColor: BEIGE,
    paddingHorizontal: 22
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
  viewer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BEIGE,
    zIndex: 50,
    paddingHorizontal: 22,
    paddingBottom: 16
  },
  viewerFrame: {
    flex: 1,
    minHeight: 280,
    backgroundColor: PAPER,
    borderWidth: 1,
    borderColor: LINE
  },
  viewerImage: {
    width: "100%",
    height: "100%"
  },
  viewerAlt: {
    marginTop: 12,
    fontFamily: SANS,
    fontSize: 15,
    lineHeight: 22,
    color: BROWN
  },
  viewerNav: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  link: {
    fontFamily: SERIF_ITALIC,
    fontSize: 18,
    color: BROWN
  },
  count: {
    fontFamily: SANS_MED,
    fontSize: 13,
    color: MUTED,
    fontVariant: ["tabular-nums"]
  }
});
