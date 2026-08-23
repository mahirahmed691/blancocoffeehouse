import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { tap } from "./feel";
import { SANS_MED, SANS_SEMI, SERIF, SERIF_ITALIC, useHouse, useStyles, type Palette } from "./theme";

export type MarkName =
  | "menu"
  | "look"
  | "bag"
  | "you"
  | "camera"
  | "roll"
  | "card"
  | "counter"
  | "map"
  | "share"
  | "pictures"
  | "today"
  | "settings"
  | "site"
  | "instagram"
  | "google"
  | "house"
  | "go"
  | "back"
  | "desk";

const OUT: Record<MarkName, keyof typeof Ionicons.glyphMap> = {
  menu: "cafe-outline",
  look: "images-outline",
  bag: "bag-handle-outline",
  you: "person-outline",
  camera: "camera-outline",
  roll: "image-outline",
  card: "card-outline",
  counter: "cafe-outline",
  map: "map-outline",
  share: "share-outline",
  pictures: "images-outline",
  today: "cafe-outline",
  settings: "settings-outline",
  site: "globe-outline",
  instagram: "logo-instagram",
  google: "star-outline",
  house: "home-outline",
  go: "chevron-forward",
  back: "chevron-back",
  desk: "storefront-outline"
};

const ON: Partial<Record<MarkName, keyof typeof Ionicons.glyphMap>> = {
  menu: "cafe",
  look: "images",
  bag: "bag-handle",
  you: "person"
};

export function Mark({
  name,
  on,
  size = 20,
  color
}: {
  name: MarkName;
  on?: boolean;
  size?: number;
  color?: string;
}) {
  const t = useHouse();
  return <Ionicons name={(on && ON[name]) || OUT[name]} size={size} color={color || t.BROWN} />;
}

export function Kicker({ label }: { label: string }) {
  const { t, styles } = useStyles(makeStyles);
  return (
    <View style={styles.kicker}>
      <Image
        source={require("./assets/mark.png")}
        style={styles.kickerMark}
        tintColor={t.night ? t.BROWN : undefined}
      />
      <Text style={styles.kickerText}>{label}</Text>
    </View>
  );
}

export function Stick<T extends string>({
  value,
  options,
  onChange,
  style
}: {
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { styles } = useStyles(makeStyles);
  const index = Math.max(0, options.indexOf(value));
  const [track, setTrack] = useState(0);
  const slide = useRef(new Animated.Value(index)).current;
  const pad = 4;
  const count = options.length || 1;
  const thumb = track ? (track - pad * 2) / count : 0;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: index,
      useNativeDriver: true,
      friction: 7,
      tension: 68
    }).start();
  }, [index, slide]);

  return (
    <View
      style={[styles.stick, style]}
      onLayout={(e) => setTrack(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {thumb ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.stickThumb,
            {
              width: thumb,
              transform: [
                {
                  translateX: slide.interpolate({
                    inputRange: options.map((_, i) => i),
                    outputRange: options.map((_, i) => i * thumb)
                  })
                }
              ]
            }
          ]}
        />
      ) : null}
      {options.map((id) => {
        const on = value === id;
        return (
          <Pressable
            key={id}
            onPress={() => {
              if (on) return;
              tap();
              onChange(id);
            }}
            style={styles.stickBtn}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text
              style={[styles.stickText, on && styles.stickTextOn]}
              numberOfLines={1}
            >
              {id}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function FoldHead({
  label,
  count,
  open,
  onPress
}: {
  label: string;
  count?: number | string;
  open: boolean;
  onPress: () => void;
}) {
  const { styles } = useStyles(makeStyles);
  const cue = count == null || count === "" ? "" : String(count);
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [styles.fold, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={cue ? label + ", " + cue : label}
    >
      <Text style={styles.foldLabel}>{label}</Text>
      {cue ? <Text style={styles.foldCount}>{cue}</Text> : null}
      <View style={[styles.foldMark, open && styles.foldMarkOn]} />
    </Pressable>
  );
}

export function Back({
  label,
  onPress
}: {
  label: string;
  onPress: () => void;
}) {
  const { styles } = useStyles(makeStyles);
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      hitSlop={12}
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Mark name="back" size={18} />
      <Text style={styles.backText}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
  kicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12
  },
  kickerMark: {
    width: 22,
    height: 22,
    borderRadius: 11
  },
  kickerText: {
    fontFamily: SANS_MED,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: t.MUTED
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginBottom: 16
  },
  backText: {
    fontFamily: SERIF_ITALIC,
    fontSize: 18,
    color: t.BROWN
  },
  pressed: {
    opacity: 0.7
  },
  stick: {
    position: "relative",
    flexDirection: "row",
    alignSelf: "stretch",
    marginTop: 4,
    marginBottom: 4,
    padding: 4,
    backgroundColor: t.PAPER,
    borderWidth: 1,
    borderColor: t.LINE,
    borderRadius: 16
  },
  stickThumb: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    backgroundColor: t.BROWN,
    borderRadius: 12
  },
  stickBtn: {
    flex: 1,
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10
  },
  stickText: {
    fontFamily: SANS_SEMI,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: t.BROWN
  },
  stickTextOn: {
    color: t.BEIGE
  },
  fold: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    paddingVertical: 6
  },
  foldLabel: {
    flex: 1,
    fontFamily: SERIF,
    fontSize: 20,
    color: t.BROWN,
    letterSpacing: -0.3
  },
  foldCount: {
    fontFamily: SANS_MED,
    fontSize: 11,
    letterSpacing: 1.6,
    color: t.MUTED
  },
  foldMark: {
    width: 7,
    height: 7,
    marginBottom: 4,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: t.BROWN,
    transform: [{ rotate: "45deg" }],
    opacity: 0.55
  },
  foldMarkOn: {
    transform: [{ rotate: "225deg" }],
    marginBottom: 1
  }
});
}

