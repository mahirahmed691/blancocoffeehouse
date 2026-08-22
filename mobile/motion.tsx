import { useEffect, useRef, type ReactNode } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";

export function Rise({
  children,
  delay = 0,
  shift = true,
  style
}: {
  children: ReactNode;
  delay?: number;
  shift?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(shift ? 8 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        delay,
        useNativeDriver: true
      }),
      Animated.spring(y, {
        toValue: 0,
        delay,
        useNativeDriver: true,
        friction: 8,
        tension: 76
      })
    ]).start();
  }, [delay, opacity, y]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY: y }] }]}>
      {children}
    </Animated.View>
  );
}

export function Pop({
  on,
  children
}: {
  on: boolean;
  children: ReactNode;
}) {
  const scale = useRef(new Animated.Value(on ? 1.06 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: on ? 1.06 : 1,
      useNativeDriver: true,
      friction: 7,
      tension: 160
    }).start();
  }, [on, scale]);

  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

export function Fill({
  on,
  children
}: {
  on: boolean;
  children: ReactNode;
}) {
  const v = useRef(new Animated.Value(on ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(v, {
      toValue: on ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 96
    }).start();
  }, [on, v]);

  return (
    <Animated.View
      style={{
        width: "100%",
        height: "100%",
        opacity: v,
        transform: [
          {
            scale: v.interpolate({
              inputRange: [0, 1],
              outputRange: [0.72, 1]
            })
          }
        ]
      }}
    >
      {children}
    </Animated.View>
  );
}
