import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { tap } from "./feel";
import { useHouse } from "./theme";

export function StampCup({ on }: { on: boolean }) {
  const t = useHouse();
  const fill = useRef(new Animated.Value(on ? 1 : 0)).current;
  const wait = useRef(new Animated.Value(on ? 0 : 1)).current;
  const got = useRef(new Animated.Value(on ? 1 : 0)).current;
  const cup = useRef(new Animated.Value(on ? 1 : 0.4)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    Animated.parallel([
      Animated.spring(fill, {
        toValue: on ? 1 : 0,
        useNativeDriver: true,
        friction: 8,
        tension: 46
      }),
      Animated.timing(wait, {
        toValue: on ? 0 : 1,
        duration: on ? 280 : 200,
        useNativeDriver: true
      }),
      Animated.timing(got, {
        toValue: on ? 1 : 0,
        duration: 360,
        delay: on ? 160 : 0,
        useNativeDriver: true
      }),
      Animated.timing(cup, {
        toValue: on ? 1 : 0.4,
        duration: 280,
        useNativeDriver: true
      })
    ]).start();
    if (on) tap();
  }, [cup, fill, got, on, wait]);

  return (
    <View
      style={{ width: "100%", aspectRatio: 1 }}
      pointerEvents="none"
      accessible={false}
    >
      <Animated.View style={{ flex: 1, opacity: cup }}>
        <View
          style={{
            position: "absolute",
            left: "12%",
            top: "18%",
            width: "62%",
            height: "62%",
            borderWidth: 1.5,
            borderColor: t.BROWN,
            borderTopLeftRadius: 5,
            borderTopRightRadius: 5,
            borderBottomLeftRadius: 13,
            borderBottomRightRadius: 13,
            overflow: "hidden",
            backgroundColor: "transparent"
          }}
        >
          <Animated.View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: "100%",
              backgroundColor: t.BROWN,
              transformOrigin: "bottom",
              transform: [{ scaleY: fill }]
            }}
          />
          <Animated.Image
            source={require("./assets/mark-b.png")}
            style={{
              position: "absolute",
              left: "8%",
              top: "8%",
              width: "84%",
              height: "84%",
              opacity: wait.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.5]
              })
            }}
            tintColor={t.BROWN}
            resizeMode="contain"
          />
          <Animated.Image
            source={require("./assets/mark-b.png")}
            style={{
              position: "absolute",
              left: "8%",
              top: "8%",
              width: "84%",
              height: "84%",
              opacity: got
            }}
            tintColor={t.BEIGE}
            resizeMode="contain"
          />
        </View>
        <View
          style={{
            position: "absolute",
            left: "70%",
            top: "32%",
            width: "16%",
            height: "32%",
            borderWidth: 1.5,
            borderColor: t.BROWN,
            borderRadius: 8,
            backgroundColor: "transparent"
          }}
        />
      </Animated.View>
    </View>
  );
}
