import { useSafeAreaInsets } from "react-native-safe-area-context";

export const BEIGE = "#e9e1d8";
export const PAPER = "#efe9e2";
export const BROWN = "#503931";
export const MUTED = "#76635b";
export const INK = "#2a1e1a";
export const LINE = "rgba(80,57,49,0.12)";

export const ROUND = "Nunito_800ExtraBold";
export const ROUND_BOLD = "Nunito_700Bold";
export const SERIF = "Fraunces_600SemiBold";
export const SERIF_ITALIC = "Fraunces_500Medium_Italic";
export const SANS = "WorkSans_400Regular";
export const SANS_MED = "WorkSans_500Medium";
export const SANS_SEMI = "WorkSans_600SemiBold";

export function usePad() {
  const insets = useSafeAreaInsets();
  return {
    top: insets.top + 12,
    bottom: Math.max(insets.bottom, 10),
    toast: 72 + Math.max(insets.bottom, 10)
  };
}
