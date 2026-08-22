import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { tap } from "./feel";
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
import { Kicker } from "./ui";

type Filter = "all" | ShotKind;

export function LookScreen({
  board,
  onBoard,
  piece,
  onOpen,
  onBackPiece
}: {
  board: LookBoard;
  onBoard: (next: LookBoard) => void;
  piece: Piece | null;
  onOpen: (piece: Piece) => void;
  onBackPiece: () => void;
}) {
  if (piece) return <PieceView piece={piece} onBack={onBackPiece} />;
  if (board === "pictures") return <Pictures onBoard={onBoard} />;
  return <Wear onBoard={onBoard} onOpen={onOpen} />;
}

function LookHead({
  board,
  onBoard,
  title,
  line
}: {
  board: LookBoard;
  onBoard: (next: LookBoard) => void;
  title: string;
  line: string;
}) {
  return (
    <>
      <Kicker label="look" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.prose}>{line}</Text>
      <View style={styles.seg}>
        {(["pictures", "wear"] as const).map((id) => (
          <Pressable
            key={id}
            onPress={() => {
              tap();
              onBoard(id);
            }}
            style={[styles.segBtn, board === id && styles.segOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: board === id }}
          >
            <Text style={[styles.segText, board === id && styles.segTextOn]}>{id}</Text>
          </Pressable>
        ))}
      </View>
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
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.screenInner, { paddingTop: pad.top, paddingBottom: 28 }]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={BROWN} />
        }
      >
        <LookHead
          board="pictures"
          onBoard={onBoard}
          title="the house, in pictures."
          line="Photographs from Fiveways Parade — the cup, the case, and the room. New shots from the desk sit with the rest."
        />
        <View style={styles.seg}>
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
        {error ? <Text style={styles.error}>{error}</Text> : null}
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
              <Image source={{ uri: shot.uri }} style={styles.tileImage} resizeMode="cover" />
              {shot.added ? <Text style={styles.added}>{shot.added}</Text> : null}
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => openAway(INSTAGRAM)}
          style={({ pressed }) => [styles.btn, { marginTop: 22 }, pressed && styles.pressed]}
        >
          <Text style={styles.btnText}>Follow on Instagram</Text>
        </Pressable>
      </ScrollView>
      {viewing ? (
        <View style={[styles.viewer, { paddingTop: pad.top }]}>
          <Pressable
            onPress={() => {
              tap();
              setOpen(null);
            }}
            hitSlop={12}
            accessibilityRole="button"
          >
            <Text style={styles.back}>the pictures</Text>
          </Pressable>
          <View style={styles.viewerFrame}>
            <Image
              source={{ uri: viewing.uri }}
              style={styles.viewerImage}
              resizeMode="contain"
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

function Wear({
  onBoard,
  onOpen
}: {
  onBoard: (next: LookBoard) => void;
  onOpen: (piece: Piece) => void;
}) {
  const pad = usePad();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenInner, { paddingTop: pad.top, paddingBottom: 28 }]}
    >
      <LookHead
        board="wear"
        onBoard={onBoard}
        title="wear blanco."
        line="The geometric b. on a tee, a hoodie, a tote — and the coffee club shirt already behind the counter. Not in the shop yet."
      />
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
              <Image source={piece.source} style={styles.cardImage} resizeMode="cover" />
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
        <Text style={styles.btnText}>Follow the drop</Text>
      </Pressable>
    </ScrollView>
  );
}

function PieceView({ piece, onBack }: { piece: Piece; onBack: () => void }) {
  const pad = usePad();
  return (
    <View style={[styles.piece, { paddingTop: pad.top, paddingBottom: 16 }]}>
      <Pressable
        onPress={() => {
          tap();
          onBack();
        }}
        hitSlop={12}
        accessibilityRole="button"
      >
        <Text style={styles.back}>wear</Text>
      </Pressable>
      <View style={styles.pieceFrame}>
        <Image
          source={piece.source}
          style={styles.pieceImage}
          resizeMode="cover"
          accessibilityLabel={piece.alt}
        />
      </View>
      <Text style={styles.pieceName}>{piece.name}</Text>
      <Text style={styles.pieceLine}>{piece.line}</Text>
      <Pressable
        onPress={() => openAway(INSTAGRAM)}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      >
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
  title: {
    fontFamily: ROUND,
    fontSize: 40,
    letterSpacing: -1.2,
    color: BROWN,
    marginBottom: 12,
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
  seg: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16
  },
  segBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: BROWN,
    borderRadius: 999
  },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
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
    opacity: 0.35
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
