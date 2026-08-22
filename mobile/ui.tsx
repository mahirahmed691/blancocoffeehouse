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
import { BEIGE, BROWN, LINE, MUTED, PAPER, SANS_MED, SANS_SEMI, SERIF_ITALIC } from "./theme";

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
  | "back";

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
  back: "chevron-back"
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
  color = BROWN
}: {
  name: MarkName;
  on?: boolean;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={(on && ON[name]) || OUT[name]} size={size} color={color} />;
}

export function Kicker({ label }: { label: string }) {
  return (
    <View style={styles.kicker}>
      <Image source={require("./assets/mark.png")} style={styles.kickerMark} />
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

export function Back({
  label,
  onPress
}: {
  label: string;
  onPress: () => void;
}) {
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

const styles = StyleSheet.create({
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
    color: MUTED
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
    color: BROWN
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
    backgroundColor: PAPER,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 16
  },
  stickThumb: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    backgroundColor: BROWN,
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
    color: BROWN
  },
  stickTextOn: {
    color: BEIGE
  }
});
