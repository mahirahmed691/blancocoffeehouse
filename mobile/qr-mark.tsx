import { Image } from "expo-image";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { useStyles, type Palette } from "./theme";

const PLATE = "#efe9e2";
const MIN = 240;

export function HouseQr({
  svg,
  png,
  size
}: {
  svg?: string;
  png?: string;
  size: number;
}) {
  const { styles } = useStyles(makeStyles);
  const box = Math.max(MIN, Math.round(size || MIN));
  const inner = Math.max(180, box - 28);
  const html = useMemo(() => {
    const body = String(svg || "").replace(/<\/?script\b[^>]*>/gi, "");
    if (!body) return "";
    return (
      "<!doctype html><html><head><meta name=\"viewport\" content=\"width=" +
      inner +
      ", initial-scale=1, maximum-scale=1\" /></head>" +
      "<body style=\"margin:0;width:" +
      inner +
      "px;height:" +
      inner +
      "px;background:" +
      PLATE +
      "\">" +
      body +
      "</body></html>"
    );
  }, [svg, inner]);

  return (
    <View style={[styles.plate, { width: box, height: box }]} accessibilityRole="image">
      {png ? (
        <Image source={{ uri: png }} style={{ width: inner, height: inner }} contentFit="contain" />
      ) : html ? (
        <WebView
          originWhitelist={["*"]}
          source={{ html }}
          scrollEnabled={false}
          style={[styles.web, { width: inner, height: inner }]}
          androidLayerType="software"
        />
      ) : null}
      {png || html ? (
        <View style={styles.seal} pointerEvents="none">
          <Image source={require("./assets/mark-b.png")} style={styles.mark} contentFit="contain" />
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    plate: {
      backgroundColor: PLATE,
      borderWidth: 1,
      borderColor: t.LINE,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      minWidth: MIN,
      minHeight: MIN
    },
    web: {
      backgroundColor: PLATE
    },
    seal: {
      position: "absolute",
      width: "22%",
      aspectRatio: 1,
      borderRadius: 999,
      backgroundColor: PLATE,
      alignItems: "center",
      justifyContent: "center",
      padding: 6
    },
    mark: {
      width: "100%",
      height: "100%"
    }
  });
}
