import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type Palette = {
  BEIGE: string;
  PAPER: string;
  BROWN: string;
  MUTED: string;
  INK: string;
  LINE: string;
  night: boolean;
};

export const LIGHT: Palette = {
  BEIGE: "#e9e1d8",
  PAPER: "#efe9e2",
  BROWN: "#503931",
  MUTED: "#76635b",
  INK: "#2a1e1a",
  LINE: "rgba(80,57,49,0.12)",
  night: false
};

export const DARK: Palette = {
  BEIGE: "#1a1412",
  PAPER: "#251c18",
  BROWN: "#e9e1d8",
  MUTED: "#b4a096",
  INK: "#f4ece6",
  LINE: "rgba(233,225,216,0.14)",
  night: true
};

export const BEIGE = LIGHT.BEIGE;
export const PAPER = LIGHT.PAPER;
export const BROWN = LIGHT.BROWN;
export const MUTED = LIGHT.MUTED;
export const INK = LIGHT.INK;
export const LINE = LIGHT.LINE;

export const ROUND = "Nunito_800ExtraBold";
export const ROUND_BOLD = "Nunito_700Bold";
export const SERIF = "Fraunces_600SemiBold";
export const SERIF_ITALIC = "Fraunces_500Medium_Italic";
export const SANS = "WorkSans_400Regular";
export const SANS_MED = "WorkSans_500Medium";
export const SANS_SEMI = "WorkSans_600SemiBold";

const HouseCtx = createContext<Palette>(LIGHT);

export function HouseProvider({
  night,
  children
}: {
  night: boolean;
  children: ReactNode;
}) {
  const value = useMemo(() => (night ? DARK : LIGHT), [night]);
  return createElement(HouseCtx.Provider, { value }, children);
}

export function useHouse() {
  return useContext(HouseCtx);
}

export function useStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  make: (t: Palette) => T
) {
  const t = useHouse();
  const styles = useMemo(() => make(t), [t]);
  return { t, styles };
}

export function usePad() {
  const insets = useSafeAreaInsets();
  return {
    top: insets.top + 12,
    bottom: Math.max(insets.bottom, 10),
    toast: 72 + Math.max(insets.bottom, 10)
  };
}
