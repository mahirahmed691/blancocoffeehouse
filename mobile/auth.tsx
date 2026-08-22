import { isClerkAPIResponseError, useSignIn, useSignUp } from "@clerk/expo";
import { useSignInWithApple } from "@clerk/expo/apple";
import { useSSO } from "@clerk/expo/experimental";
import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { tap } from "./feel";
import {
  ROUND,
  SANS,
  SANS_MED,
  SERIF_ITALIC,
  usePad,
  useStyles,
  type Palette
} from "./theme";

type Step = "enter" | "verify";
type VerifyKind = "signup" | "mfa";

function fieldLine(error: { message?: string; longMessage?: string } | null | undefined) {
  if (!error) return "";
  return error.longMessage || error.message || "";
}

function missingAccount(error: { code?: string } | null | undefined) {
  if (!error) return false;
  if (error.code === "form_identifier_not_found") return true;
  if (isClerkAPIResponseError(error)) {
    return error.errors.some((item) => item.code === "form_identifier_not_found");
  }
  return false;
}

function cancelledAuth(err: unknown) {
  const code = String((err as { code?: string | number })?.code || "");
  return (
    code === "ERR_REQUEST_CANCELED" ||
    code === "ERR_CANCELED" ||
    code === "SIGN_IN_CANCELLED" ||
    code === "-5"
  );
}

export function Gate() {
  const pad = usePad();
  const { signIn, errors: inErrors, fetchStatus: inStatus } = useSignIn();
  const { signUp, errors: upErrors, fetchStatus: upStatus } = useSignUp();
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const [appleOn, setAppleOn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("enter");
  const [kind, setKind] = useState<VerifyKind>("signup");
  const [note, setNote] = useState("");
  const [ssoBusy, setSsoBusy] = useState(false);
  const { t, styles } = useStyles(makeStyles);

  const busy = inStatus === "fetching" || upStatus === "fetching" || ssoBusy;

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleOn)
      .catch(() => setAppleOn(false));
  }, []);
  const emailLine = fieldLine(inErrors.fields.identifier) || fieldLine(upErrors.fields.emailAddress);
  const passLine = fieldLine(inErrors.fields.password) || fieldLine(upErrors.fields.password);
  const codeLine = fieldLine(inErrors.fields.code) || fieldLine(upErrors.fields.code);
  const globalLine =
    note ||
    fieldLine(inErrors.global?.[0]) ||
    fieldLine(upErrors.global?.[0]) ||
    fieldLine(upErrors.fields.captcha);

  async function finishIn() {
    if (signIn.status === "complete") {
      await signIn.finalize();
      return true;
    }
    if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") {
      const emailFactor = signIn.supportedSecondFactors?.find((factor) => factor.strategy === "email_code");
      if (emailFactor) {
        const sent = await signIn.mfa.sendEmailCode();
        if (sent.error) {
          setNote(sent.error.longMessage || sent.error.message);
          return true;
        }
        setKind("mfa");
        setStep("verify");
        setCode("");
        setNote("We sent a code to your email.");
        return true;
      }
      setNote("This account needs another step we cannot do in the app yet.");
      return true;
    }
    return false;
  }

  async function startSignup() {
    const created = await signUp.password({ emailAddress: email.trim(), password });
    if (created.error) {
      setNote(created.error.longMessage || created.error.message);
      return;
    }
    if (signUp.status === "complete") {
      await signUp.finalize();
      return;
    }
    const sent = await signUp.verifications.sendEmailCode();
    if (sent.error) {
      setNote(sent.error.longMessage || sent.error.message);
      return;
    }
    setKind("signup");
    setStep("verify");
    setCode("");
    setNote("We sent a code to your email.");
  }

  async function finishSocial(
    createdSessionId: string | null | undefined,
    up: unknown,
    authType?: string
  ) {
    const social = up as {
      status?: string | null;
      unverifiedFields?: string[] | null;
      verifications?: {
        sendEmailCode?: () => Promise<{ error?: { longMessage?: string; message?: string } | null } | null>;
      };
    } | null | undefined;
    if (createdSessionId) return true;
    if (authType === "cancel" || authType === "dismiss") return true;
    if (social?.status === "missing_requirements") {
      if (social.unverifiedFields?.includes("email_address") && social.verifications?.sendEmailCode) {
        const sent = await social.verifications.sendEmailCode();
        if (!sent?.error) {
          setKind("signup");
          setStep("verify");
          setCode("");
          setNote("We sent a code to your email.");
          return true;
        }
      }
      setNote("That sign-in needs another step we cannot finish here.");
      return true;
    }
    return false;
  }

  async function onSocial(strategy: "oauth_apple" | "oauth_google") {
    const { createdSessionId, signUp: up, authSessionResult } = await startSSOFlow({
      strategy
    });
    const done = await finishSocial(createdSessionId, up, authSessionResult?.type);
    if (!done) setNote("That sign-in could not finish.");
  }

  async function onApple() {
    if (busy) return;
    tap();
    setNote("");
    setSsoBusy(true);
    try {
      if (Platform.OS === "ios" && appleOn) {
        try {
          const { createdSessionId, setActive, signUp: up } = await startAppleAuthenticationFlow();
          if (createdSessionId && setActive) {
            await setActive({ session: createdSessionId });
            return;
          }
          const done = await finishSocial(createdSessionId, up);
          if (done) return;
        } catch (err) {
          if (cancelledAuth(err)) return;
        }
      }
      await onSocial("oauth_apple");
    } catch (err) {
      if (cancelledAuth(err)) return;
      const error = err as { longMessage?: string; message?: string };
      setNote(error.longMessage || error.message || "That sign-in could not finish.");
    } finally {
      setSsoBusy(false);
    }
  }

  async function onGoogle() {
    if (busy) return;
    tap();
    setNote("");
    setSsoBusy(true);
    try {
      await onSocial("oauth_google");
    } catch (err) {
      if (cancelledAuth(err)) return;
      const error = err as { longMessage?: string; message?: string };
      setNote(error.longMessage || error.message || "That sign-in could not finish.");
    } finally {
      setSsoBusy(false);
    }
  }

  async function onEnter() {
    tap();
    setNote("");
    const attempt = await signIn.password({ emailAddress: email.trim(), password });
    if (attempt.error) {
      if (missingAccount(attempt.error)) {
        await startSignup();
        return;
      }
      setNote(attempt.error.longMessage || attempt.error.message);
      return;
    }
    const handled = await finishIn();
    if (!handled) setNote("That sign-in could not finish.");
  }

  async function onVerify() {
    tap();
    setNote("");
    if (kind === "mfa") {
      const checked = await signIn.mfa.verifyEmailCode({ code: code.trim() });
      if (checked.error) {
        setNote(checked.error.longMessage || checked.error.message);
        return;
      }
      if (signIn.status === "complete") {
        await signIn.finalize();
        return;
      }
      setNote("That code could not finish the sign-in.");
      return;
    }
    const checked = await signUp.verifications.verifyEmailCode({ code: code.trim() });
    if (checked.error) {
      setNote(checked.error.longMessage || checked.error.message);
      return;
    }
    if (signUp.status === "complete") {
      await signUp.finalize();
      return;
    }
    setNote("That code could not finish the sign-up.");
  }

  async function onResend() {
    setNote("");
    if (kind === "mfa") {
      const sent = await signIn.mfa.sendEmailCode();
      if (sent.error) setNote(sent.error.longMessage || sent.error.message);
      else setNote("We sent another code.");
      return;
    }
    const sent = await signUp.verifications.sendEmailCode();
    if (sent.error) setNote(sent.error.longMessage || sent.error.message);
    else setNote("We sent another code.");
  }

  async function onStartOver() {
    setCode("");
    setNote("");
    setStep("enter");
    await signIn.reset();
    await signUp.reset();
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.inner,
          { paddingTop: pad.top, paddingBottom: 40 + pad.bottom }
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View nativeID="clerk-captcha" style={styles.captcha} />
        <Image
          source={require("./assets/mark.png")}
          style={styles.mark}
          tintColor={t.night ? t.BROWN : undefined}
        />
        <Text style={styles.word}>blanco.</Text>
        <Text style={styles.tag}>your way.</Text>
        <Text style={styles.title}>
          {step === "enter" ? "your way in." : "check your email."}
        </Text>
        <Text style={styles.line}>
          {step === "enter"
            ? "Apple, Google, or email. Same door for members and first visits."
            : "The house sent a code. Enter it to finish."}
        </Text>

        {step === "enter" ? (
          <>
            {appleOn ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
                cornerRadius={999}
                style={[styles.appleBtn, { marginTop: 22 }, busy ? styles.dim : null]}
                onPress={onApple}
              />
            ) : (
              <Pressable
                style={({ pressed }) => [styles.btnGhost, { marginTop: 22 }, pressed && styles.pressed, busy && styles.dim]}
                onPress={onApple}
                disabled={busy}
              >
                <Text style={styles.btnGhostText}>
                  {ssoBusy ? "one moment…" : "continue with Apple."}
                </Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed, busy && styles.dim]}
              onPress={onGoogle}
              disabled={busy}
            >
              <Text style={styles.btnGhostText}>
                {ssoBusy ? "one moment…" : "continue with Google."}
              </Text>
            </Pressable>

            {globalLine ? <Text style={styles.status}>{globalLine}</Text> : null}

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>

            <Text style={styles.label}>email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@email"
              placeholderTextColor={t.MUTED}
              keyboardAppearance={t.night ? "dark" : "light"}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
            />
            {emailLine ? <Text style={styles.field}>{emailLine}</Text> : null}

            <Text style={styles.label}>password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="your way in"
              placeholderTextColor={t.MUTED}
              keyboardAppearance={t.night ? "dark" : "light"}
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => {
                if (!busy && email.trim() && password) onEnter();
              }}
            />
            {passLine ? <Text style={styles.field}>{passLine}</Text> : null}

            <Pressable
              style={({ pressed }) => [styles.btn, pressed && styles.pressed, busy && styles.dim]}
              onPress={onEnter}
              disabled={busy || !email.trim() || !password}
            >
              <Text style={styles.btnText}>{busy && !ssoBusy ? "one moment…" : "enter the house."}</Text>
            </Pressable>
            <Text style={styles.hint}>New here? Same door.</Text>
          </>
        ) : (
          <>
            <Text style={styles.label}>the code</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="000000"
              placeholderTextColor={t.MUTED}
              keyboardAppearance={t.night ? "dark" : "light"}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              returnKeyType="go"
              onSubmitEditing={() => {
                if (!busy && code.trim()) onVerify();
              }}
            />
            {codeLine ? <Text style={styles.field}>{codeLine}</Text> : null}
            {globalLine ? <Text style={styles.status}>{globalLine}</Text> : null}

            <Pressable
              style={({ pressed }) => [styles.btn, pressed && styles.pressed, busy && styles.dim]}
              onPress={onVerify}
              disabled={busy || !code.trim()}
            >
              <Text style={styles.btnText}>{busy ? "one moment…" : "let me in."}</Text>
            </Pressable>
            <Pressable onPress={onResend} disabled={busy} hitSlop={8}>
              <Text style={styles.link}>send it again</Text>
            </Pressable>
            <Pressable onPress={onStartOver} disabled={busy} hitSlop={8}>
              <Text style={styles.link}>start over</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(t: Palette) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: t.BEIGE
  },
  inner: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: "center"
  },
  captcha: {
    height: 0,
    overflow: "hidden"
  },
  mark: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: 12
  },
  word: {
    fontFamily: ROUND,
    fontSize: 40,
    color: t.BROWN,
    letterSpacing: -1.2
  },
  tag: {
    marginTop: 6,
    fontFamily: SANS_MED,
    fontSize: 11,
    letterSpacing: 3.4,
    textTransform: "uppercase",
    color: t.MUTED
  },
  title: {
    marginTop: 28,
    fontFamily: ROUND,
    fontSize: 40,
    letterSpacing: -1.2,
    color: t.BROWN,
    lineHeight: 42,
    textTransform: "lowercase"
  },
  line: {
    marginTop: 12,
    marginBottom: 8,
    fontFamily: SANS,
    fontSize: 16,
    lineHeight: 24,
    color: t.MUTED,
    maxWidth: 360
  },
  label: {
    marginTop: 22,
    marginBottom: 8,
    fontFamily: SANS_MED,
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: t.MUTED
  },
  input: {
    borderWidth: 1,
    borderColor: t.LINE,
    backgroundColor: t.PAPER,
    color: t.BROWN,
    fontFamily: SANS,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    borderRadius: 2
  },
  field: {
    marginTop: 8,
    fontFamily: SANS,
    fontSize: 14,
    color: t.BROWN
  },
  status: {
    marginTop: 14,
    fontFamily: SANS,
    fontSize: 15,
    color: t.BROWN
  },
  btn: {
    marginTop: 22,
    backgroundColor: t.BROWN,
    paddingVertical: 15,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999
  },
  btnText: {
    fontFamily: SANS_MED,
    color: t.BEIGE,
    fontSize: 15,
    letterSpacing: 0.4
  },
  appleBtn: {
    width: "100%",
    height: 48
  },
  btnGhost: {
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: t.BROWN,
    paddingVertical: 13,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999
  },
  btnGhostText: {
    fontFamily: SANS_MED,
    color: t.BROWN,
    fontSize: 15,
    letterSpacing: 0.4
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 22
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: t.LINE
  },
  orText: {
    fontFamily: SANS_MED,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: t.MUTED
  },
  hint: {
    marginTop: 16,
    fontFamily: SERIF_ITALIC,
    fontSize: 17,
    color: t.BROWN
  },
  link: {
    marginTop: 14,
    fontFamily: SERIF_ITALIC,
    fontSize: 17,
    color: t.BROWN
  },
  pressed: {
    opacity: 0.82
  },
  dim: {
    opacity: 0.55
  }
});
}

