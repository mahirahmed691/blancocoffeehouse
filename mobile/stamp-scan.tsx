import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ok, tap, warn } from "./feel";
import { redeemStamp, stampTokenFromHref, type Session } from "./house";

let CameraView: typeof import("expo-camera").CameraView | null = null;
let useCameraPermissions: typeof import("expo-camera").useCameraPermissions = () => [
  null,
  async () => ({ granted: false, canAskAgain: false, expires: "never", status: "undetermined" })
];
try {
  const cam = require("expo-camera") as typeof import("expo-camera");
  CameraView = cam.CameraView;
  useCameraPermissions = cam.useCameraPermissions;
} catch {
  /* this phone build does not have the scanner yet */
}
import { Rise } from "./motion";
import { SANS, SANS_MED, SERIF_ITALIC, usePad, useStyles, type Palette } from "./theme";
import { Back, Kicker } from "./ui";

export function StampScanScreen({
  getSession,
  incoming,
  onRedeemed,
  onBack
}: {
  getSession: () => Promise<Session>;
  incoming?: string;
  onRedeemed: (card: { stamps: number; cards_done: number; filled?: boolean }) => void;
  onBack: () => void;
}) {
  const { t, styles } = useStyles(makeStyles);
  const pad = usePad();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState("");
  const lock = useRef(false);

  async function take(token: string) {
    const code = String(token || "").trim();
    if (!code || lock.current) return;
    lock.current = true;
    tap();
    setStatus("taking the stamp…");
    try {
      const card = await redeemStamp(await getSession(), code);
      ok();
      setStatus(card.filled ? "a drink on the house. the card starts again." : "a stamp from the house.");
      onRedeemed(card);
    } catch (err) {
      warn();
      setStatus(err instanceof Error ? err.message : "the stamp could not land.");
      lock.current = false;
    }
  }

  useEffect(() => {
    if (incoming) take(incoming);
  }, [incoming]);

  useEffect(() => {
    if (!CameraView || !permission) return;
    if (permission.status === "undetermined") requestPermission();
  }, [permission]);

  const ready = !!CameraView && !!permission?.granted;

  return (
    <Rise style={styles.screen}>
      <View style={[styles.head, { paddingTop: pad.top }]}>
        <Back label="you" onPress={onBack} />
        <Kicker label="stamps" />
        <Text style={styles.title}>scan.</Text>
        <Text style={styles.prose}>the house QR at the counter.</Text>
      </View>
      {ready && CameraView ? (
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }) => {
            const raw = String(data || "").trim();
            const token =
              stampTokenFromHref(raw) || (/^[A-Za-z0-9_-]{20,48}$/.test(raw) ? raw : "");
            if (token) take(token);
          }}
        />
      ) : (
        <View style={styles.fallback}>
          <Text style={styles.prose}>
            {!CameraView
              ? "this phone build cannot scan yet. point the phone camera at the house QR. it opens the card."
              : permission && !permission.granted
                ? "the camera is off for blanco. point the phone camera at the house QR instead."
                : "opening the camera…"}
          </Text>
          {CameraView && permission && !permission.granted ? (
            <Pressable
              onPress={() => {
                tap();
                requestPermission();
              }}
              style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
            >
              <Text style={styles.btnText}>Allow the camera</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </Rise>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
    screen: { flex: 1 },
    head: { paddingHorizontal: 22, paddingBottom: 12 },
    title: {
      fontFamily: SERIF_ITALIC,
      fontSize: 32,
      letterSpacing: -0.8,
      color: t.BROWN,
      marginBottom: 8,
      lineHeight: 36
    },
    prose: {
      fontFamily: SANS,
      fontSize: 15,
      lineHeight: 22,
      color: t.MUTED
    },
    camera: {
      flex: 1,
      marginHorizontal: 22,
      marginBottom: 22,
      borderRadius: 22,
      overflow: "hidden",
      backgroundColor: t.PAPER
    },
    fallback: {
      paddingHorizontal: 22,
      paddingTop: 8
    },
    btn: {
      alignSelf: "flex-start",
      backgroundColor: t.BROWN,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10,
      minHeight: 44,
      justifyContent: "center",
      marginTop: 14
    },
    btnText: {
      fontFamily: SANS_MED,
      fontSize: 14,
      color: t.BEIGE
    },
    pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
    status: {
      fontFamily: SANS,
      fontSize: 14,
      color: t.MUTED,
      paddingHorizontal: 22,
      paddingBottom: 28
    }
  });
}
