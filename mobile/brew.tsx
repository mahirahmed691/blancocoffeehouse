import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, View } from "react-native";
import { ok, tap } from "./feel";
import { useHouse } from "./theme";

function fillOf(status: string) {
  if (status === "ready" || status === "collected") return 0.9;
  if (status === "preparing") return 0.58;
  if (status === "in") return 0.1;
  return 0;
}

function steaming(status: string) {
  return status === "in" || status === "preparing" || status === "ready";
}

function pouring(status: string) {
  return status === "preparing";
}

function heating(status: string) {
  return status === "in" || status === "preparing";
}

function useWave(on: boolean, duration: number, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!on) {
      v.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, {
          toValue: 1,
          duration,
          useNativeDriver: true
        }),
        Animated.timing(v, {
          toValue: 0,
          duration,
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      v.setValue(0);
    };
  }, [delay, duration, on, v]);

  return v;
}

export function BrewCup({ status }: { status: string }) {
  const t = useHouse();
  const [calm, setCalm] = useState(false);
  const fill = useRef(new Animated.Value(fillOf(status))).current;
  const crema = useRef(new Animated.Value(status === "ready" || status === "collected" ? 1 : 0)).current;
  const spout = useRef(new Animated.Value(heating(status) ? 1 : 0)).current;
  const stream = useRef(new Animated.Value(pouring(status) ? 1 : 0)).current;
  const seen = useRef(true);
  const steamOn = steaming(status) && !calm;
  const pourOn = pouring(status) && !calm;
  const steamA = useWave(steamOn, 1100, 0);
  const steamB = useWave(steamOn, 1300, 180);
  const steamC = useWave(steamOn, 1000, 360);
  const beadA = useWave(pourOn, 620, 0);
  const beadB = useWave(pourOn, 620, 280);

  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setCalm);
    AccessibilityInfo.isReduceMotionEnabled().then(setCalm);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const nextFill = fillOf(status);
    const nextCrema = status === "ready" || status === "collected" ? 1 : 0;
    Animated.parallel([
      Animated.spring(fill, {
        toValue: nextFill,
        useNativeDriver: true,
        friction: 8,
        tension: 42
      }),
      Animated.timing(crema, {
        toValue: nextCrema,
        duration: 420,
        useNativeDriver: true
      }),
      Animated.timing(spout, {
        toValue: heating(status) ? 1 : 0,
        duration: 280,
        useNativeDriver: true
      }),
      Animated.timing(stream, {
        toValue: pouring(status) ? 1 : 0,
        duration: 220,
        useNativeDriver: true
      })
    ]).start();
  }, [crema, fill, spout, status, stream]);

  useEffect(() => {
    if (seen.current) {
      seen.current = false;
      return;
    }
    if (status === "preparing") tap();
    if (status === "ready") ok();
  }, [status]);

  const brew = t.BROWN;
  const fillTone = t.night ? "rgba(233,225,216,0.9)" : "rgba(80,57,49,0.9)";
  const cremaTone = t.night ? "rgba(244,236,230,0.7)" : "rgba(233,225,216,0.72)";

  return (
    <View
      style={{ width: 64, height: 92, marginRight: 4 }}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={{
          position: "absolute",
          left: 14,
          top: 0,
          width: 28,
          height: 22,
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 4
        }}
      >
        {[steamA, steamB, steamC].map((wave, i) => (
          <Animated.View
            key={i}
            style={{
              width: 6,
              height: i === 1 ? 18 : 12,
              borderWidth: 1.2,
              borderBottomWidth: 0,
              borderColor: brew,
              borderTopLeftRadius: 8,
              borderTopRightRadius: 8,
              opacity: wave.interpolate({
                inputRange: [0, 1],
                outputRange: steamOn ? [0.22, 0.78] : steaming(status) ? [0.28, 0.28] : [0, 0]
              }),
              transform: [
                {
                  translateY: wave.interpolate({
                    inputRange: [0, 1],
                    outputRange: [3, -5]
                  })
                },
                {
                  scaleY: wave.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.86, 1.06]
                  })
                }
              ]
            }}
          />
        ))}
      </View>
      <Animated.View
        style={{
          position: "absolute",
          left: 20,
          top: 20,
          width: 16,
          height: 3,
          borderRadius: 2,
          backgroundColor: brew,
          opacity: spout,
          transform: [
            {
              scaleX: spout.interpolate({
                inputRange: [0, 1],
                outputRange: [0.4, 1]
              })
            }
          ]
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          left: 27,
          top: 23,
          width: 2,
          height: 20,
          borderRadius: 1,
          backgroundColor: brew,
          opacity: stream,
          transform: [{ scaleY: stream }]
        }}
      />
      {[beadA, beadB].map((bead, i) => (
        <Animated.View
          key={"bead-" + i}
          style={{
            position: "absolute",
            left: 26,
            top: 36,
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: brew,
            opacity: pourOn
              ? bead.interpolate({
                  inputRange: [0, 0.12, 1],
                  outputRange: [0, 0.7, 0]
                })
              : 0,
            transform: [
              {
                translateY: bead.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 14]
                })
              }
            ]
          }}
        />
      ))}
      <View
        style={{
          position: "absolute",
          left: 10,
          top: 44,
          width: 36,
          height: 32,
          borderWidth: 1.5,
          borderColor: brew,
          borderTopLeftRadius: 5,
          borderTopRightRadius: 5,
          borderBottomLeftRadius: 14,
          borderBottomRightRadius: 14,
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
            backgroundColor: fillTone,
            transformOrigin: "bottom",
            transform: [{ scaleY: fill }]
          }}
        >
          <Animated.View
            style={{
              height: 4,
              backgroundColor: cremaTone,
              opacity: crema
            }}
          />
        </Animated.View>
      </View>
      <View
        style={{
          position: "absolute",
          left: 42,
          top: 50,
          width: 12,
          height: 16,
          borderWidth: 1.5,
          borderColor: brew,
          borderRadius: 8,
          backgroundColor: "transparent"
        }}
      />
      <View
        style={{
          position: "absolute",
          left: 6,
          top: 78,
          width: 44,
          height: 3,
          borderRadius: 2,
          backgroundColor: brew,
          opacity: 0.28
        }}
      />
    </View>
  );
}
