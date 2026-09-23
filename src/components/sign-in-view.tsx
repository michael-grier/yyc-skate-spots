import { useSSO } from "@clerk/expo";
import { useSignInWithApple } from "@clerk/expo/apple";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { useNavigation, useRouter } from "expo-router";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BoardMark } from "@/components/board-mark";
import { PublicSiteLinks } from "@/components/public-site-links";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { describeAuthError } from "@/lib/auth-errors";
import { useEmailCodeAuth } from "@/lib/use-email-code-auth";
import { colors } from "@/theme/colors";

// Lets the OAuth browser session hand control back to the app (no-op on native).
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_SSO_REDIRECT_URL = "yycskatespots://sso-callback";

/** Shared sign-in form for the Account tab and actions that require an account. */
export function SignInView({ hasHeader = false }: { hasHeader?: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const { startSSOFlow } = useSSO();
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const {
    step: authStep,
    error,
    busy: emailBusy,
    sendCode,
    verifyCode,
    signInWithPassword,
    resendCode,
    reset,
  } = useEmailCodeAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [emailMethod, setEmailMethod] = useState<"code" | "password">("code");
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [socialBusy, setSocialBusy] = useState<"apple" | "google" | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [tabReset, setTabReset] = useState<"idle" | "pending" | "failed">("idle");
  const tabResetRunning = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const busy = emailBusy || tabReset !== "idle";
  const step = tabReset !== "idle" ? { kind: "email" as const } : authStep;

  useEffect(() => {
    const initialState = navigation.getState();
    let previousTab = initialState?.routes[initialState.index]?.name;
    return navigation.addListener("state", ({ data: { state } }) => {
      const tab = state.routes[state.index ?? 0].name;
      // App backgrounding and OAuth prompts do not change the selected tab.
      if (previousTab === "account" && (tab === "index" || tab === "add")) {
        Keyboard.dismiss();
        setEmailMethod("code");
        setPassword("");
        setCode("");
        setSsoError(null);
        setTabReset("pending");
      }
      previousTab = tab;
    });
  }, [navigation]);

  const finishTabReset = useEffectEvent(async () => {
    if (tabResetRunning.current) return;
    tabResetRunning.current = true;
    try {
      const succeeded = await reset();
      setSsoError(null);
      // A failed reset must not reveal the abandoned step or retry in a loop.
      setTabReset(succeeded ? "idle" : "failed");
    } finally {
      tabResetRunning.current = false;
    }
  });

  useEffect(() => {
    // Let an in-flight Clerk operation settle before clearing its attempt, while
    // showing the base form immediately so its late response cannot restore a step.
    if (tabReset === "pending" && !emailBusy && !socialBusy) void finishTabReset();
  }, [tabReset, emailBusy, socialBusy]);

  useEffect(() => {
    let mounted = true;
    void AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (mounted) {
          setAppleAvailable(available);
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  async function handleAppleSignIn() {
    setSsoError(null);
    setSocialBusy("apple");
    try {
      const { createdSessionId, setActive } = await startAppleAuthenticationFlow();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err) {
      // Clerk versions differ on whether a dismissed Apple prompt resolves
      // without a session or rejects with Apple's cancellation code.
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        err.code === "ERR_REQUEST_CANCELED"
      ) {
        return;
      }
      setSsoError(describeAuthError(err instanceof Error ? err : { message: String(err) }));
    } finally {
      setSocialBusy(null);
    }
  }

  async function handleGoogleSignIn() {
    setSsoError(null);
    setSocialBusy("google");
    try {
      // Keep this explicit so Clerk's production allowlist and the app cannot
      // silently disagree about the browser callback URL.
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: GOOGLE_SSO_REDIRECT_URL,
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err) {
      setSsoError(describeAuthError(err instanceof Error ? err : { message: String(err) }));
    } finally {
      setSocialBusy(null);
    }
  }

  const message = tabReset === "pending" ? null : (error ?? ssoError);
  useEffect(() => {
    if (!message || !navigation.isFocused()) return;
    // Failed attempts must be readable without manually hiding the keyboard or scrolling.
    Keyboard.dismiss();
    scroll.current?.scrollTo({ y: 0, animated: true });
  }, [message, navigation]);

  const passwordSignInDisabled =
    busy || socialBusy !== null || email.trim().length === 0 || password.length === 0;

  async function chooseEmailMethod(method: "code" | "password") {
    Keyboard.dismiss();
    if (!(await reset())) return;
    setSsoError(null);
    setEmailMethod(method);
    setPassword("");
    setCode("");
  }

  function submitPassword() {
    if (passwordSignInDisabled) {
      return;
    }
    void signInWithPassword(email, password);
  }

  return (
    <ScrollView
      ref={scroll}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="on-drag"
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: hasHeader ? 24 : insets.top + 48,
        paddingHorizontal: 28,
        paddingBottom: 40,
      }}
      className="bg-base"
    >
      <View className="h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-card">
        <BoardMark size={28} />
      </View>
      <Text className="mt-6 font-sans-semibold text-[28px] tracking-tight text-ink">
        YYC Skate Spots
      </Text>
      <Text className="mt-2 font-sans text-[14px] leading-relaxed text-mute">
        Sign in to save favourite spots, add new ones, and manage the spots you&apos;ve shared.
        Browsing never needs an account.
      </Text>

      {message ? (
        <Text
          accessibilityRole="alert"
          className="mt-4 text-center font-sans text-[13px] text-bust-high"
        >
          {message}
        </Text>
      ) : null}

      {step.kind === "email" && emailMethod === "code" ? (
        <View className="mt-9 gap-2.5">
          {appleAvailable ? (
            <View
              pointerEvents={busy || socialBusy ? "none" : "auto"}
              style={{ opacity: busy || socialBusy ? 0.4 : 1 }}
            >
              <AppleAuthentication.AppleAuthenticationButton
                accessibilityLabel="Continue with Apple"
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={16}
                onPress={() => void handleAppleSignIn()}
                style={{ width: "100%", height: 54 }}
              />
            </View>
          ) : null}
          <Button
            label={socialBusy === "google" ? "Opening Google…" : "Continue with Google"}
            disabled={busy || socialBusy !== null}
            onPress={() => void handleGoogleSignIn()}
          />

          <View className="flex-row items-center gap-3 py-2">
            <View className="h-px flex-1 bg-white/10" />
            <Text className="font-sans text-[12px] text-mute">or</Text>
            <View className="h-px flex-1 bg-white/10" />
          </View>

          <SignInField
            label="EMAIL"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="go"
            onSubmitEditing={() => {
              if (!busy && !socialBusy && email.trim()) void sendCode(email);
            }}
            accessibilityLabel="Email address"
          />
          <Button
            label={emailBusy && tabReset === "idle" ? "Sending code…" : "Continue"}
            disabled={busy || socialBusy !== null || email.trim().length === 0}
            onPress={() => void sendCode(email)}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy || socialBusy !== null}
            onPress={() => void chooseEmailMethod("password")}
            className="items-center py-2"
          >
            <Text className="font-sans text-[13px] text-silver">Sign in with a password</Text>
          </Pressable>
        </View>
      ) : step.kind === "email" ? (
        <View className="mt-9 gap-2.5">
          <SignInField
            label="EMAIL"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            accessibilityLabel="Email address"
          />
          <SignInField
            label="PASSWORD"
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="current-password"
            textContentType="password"
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={submitPassword}
            accessibilityLabel="Password"
          />
          <Button
            label={busy ? "Signing in…" : "Sign in"}
            disabled={passwordSignInDisabled}
            onPress={submitPassword}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void chooseEmailMethod("code")}
            className="items-center py-2"
          >
            <Text className="font-sans text-[13px] text-mute">Use an email code instead</Text>
          </Pressable>
        </View>
      ) : (
        <View className="mt-9 gap-2.5">
          <Text className="font-sans text-[14px] text-mute">
            We emailed a code to <Text className="text-ink">{step.emailAddress}</Text>.
          </Text>
          <SignInField
            label="CODE"
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => {
              if (!busy && code.trim()) void verifyCode(code);
            }}
            accessibilityLabel="Verification code"
          />
          <Button
            label={busy ? "Checking…" : "Verify"}
            disabled={busy || code.trim().length === 0}
            onPress={() => void verifyCode(code)}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void resendCode()}
            className="items-center py-2"
          >
            <Text className="font-sans text-[13px] text-mute">Send a new code</Text>
          </Pressable>
        </View>
      )}

      {step.kind !== "email" || emailMethod !== "code" ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy || socialBusy !== null}
          onPress={() => void chooseEmailMethod("code")}
          className="mt-2.5 min-h-11 items-center justify-center"
        >
          <Text className="font-sans-medium text-[14px] text-silver">Back to sign in</Text>
        </Pressable>
      ) : null}

      {tabReset === "failed" ? (
        <Button label="Retry sign-in reset" onPress={() => setTabReset("pending")} />
      ) : null}

      {/* Clerk renders its bot-protection widget here on web; skipped on native. */}
      <View nativeID="clerk-captcha" />
      <PublicSiteLinks className="mt-auto pt-8" onOpenStandards={() => router.push("/standards")} />
    </ScrollView>
  );
}

/** The label and padding focus the input too; the text line alone is a small touch target. */
function SignInField({ label, ...props }: TextInputProps & { label: string }) {
  const input = useRef<TextInput>(null);
  return (
    <Card>
      <Pressable
        accessible={false}
        onPress={() => input.current?.focus()}
        className="min-h-14 px-4 py-3"
      >
        <Text className="font-sans-medium text-[11px] text-mute">{label}</Text>
        <TextInput
          {...props}
          ref={input}
          placeholderTextColor={colors.mute}
          className="mt-0.5 font-sans text-[15px] text-ink"
          style={{ paddingVertical: 0 }}
        />
      </Pressable>
    </Card>
  );
}
