import { Image, StyleSheet, Text, View } from "react-native";
import { MUTED, SANS_MED } from "./theme";

export function Kicker({ label }: { label: string }) {
  return (
    <View style={styles.kicker}>
      <Image source={require("./assets/mark.png")} style={styles.kickerMark} />
      <Text style={styles.kickerText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10
  },
  kickerMark: {
    width: 26,
    height: 26,
    borderRadius: 13
  },
  kickerText: {
    fontFamily: SANS_MED,
    fontSize: 12,
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: MUTED
  }
});
