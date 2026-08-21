import { useSSO } from "@clerk/expo/experimental";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BoardMark } from "@/components/board-mark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { describeAuthError } from "@/lib/auth-errors";
import { useEmailCodeAuth } from "@/lib/use-email-code-auth";
import { colors } from "@/theme/colors";

// Lets the OAuth browser session hand control back to the app (no-op on native).
WebBrowser.maybeCompleteAuthSession();

type SsoStrategy = "oauth_apple" | "oauth_google";

/** Signed-out state of the Account tab: Apple, Google, or an email code. */
export function SignInView() {
  const insets = useSafeAreaInsets();
  const { startSSOFlow } = useSSO();
  const { step, error, busy, sendCode, verifyCode, resendCode, reset } = useEmailCodeAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [ssoError, setSsoError] = useState<string | null>(null);

  async function handleSso(strategy: SsoStrategy) {
    setSsoError(null);
    try {
      // A completed flow activates the session itself; a cancelled browser
      // session resolves without a session and needs no message.
      await startSSOFlow({ strategy });
    } catch (err) {
      setSsoError(describeAuthError(err instanceof Error ? err : { message: String(err) }));
    }
  }

  const message = error ?? ssoError;

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: insets.top + 48,
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
        Sign in to add spots to the map and manage the ones you’ve shared. Browsing never needs an
        account.
      </Text>

      {step.kind === "email" ? (
        <View className="mt-9 gap-2.5">
          <Button
            variant="light"
            label="Continue with Apple"
            onPress={() => void handleSso("oauth_apple")}
          />
          <Button label="Continue with Google" onPress={() => void handleSso("oauth_google")} />

          <View className="flex-row items-center gap-3 py-2">
            <View className="h-px flex-1 bg-white/10" />
            <Text className="font-sans text-[12px] text-mute">or</Text>
            <View className="h-px flex-1 bg-white/10" />
          </View>

          <Card className="px-4 py-3">
            <Text className="font-sans-medium text-[11px] text-mute">EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.mute}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="go"
              onSubmitEditing={() => void sendCode(email)}
              accessibilityLabel="Email address"
              className="mt-0.5 font-sans text-[15px] text-ink"
              style={{ paddingVertical: 0 }}
            />
          </Card>
          <Button
            label={busy ? "Sending code…" : "Continue"}
            disabled={busy || email.trim().length === 0}
            onPress={() => void sendCode(email)}
          />
        </View>
      ) : (
        <View className="mt-9 gap-2.5">
          <Text className="font-sans text-[14px] text-mute">
            We emailed a code to <Text className="text-ink">{step.emailAddress}</Text>.{" "}
            <Text className="text-silver" onPress={reset}>
              Not you?
            </Text>
          </Text>
          <Card className="px-4 py-3">
            <Text className="font-sans-medium text-[11px] text-mute">CODE</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              placeholderTextColor={colors.mute}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void verifyCode(code)}
              accessibilityLabel="Verification code"
              className="mt-0.5 font-sans text-[15px] text-ink"
              style={{ paddingVertical: 0 }}
            />
          </Card>
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

      {message ? (
        <Text accessibilityRole="alert" className="mt-4 font-sans text-[13px] text-bust-high">
          {message}
        </Text>
      ) : null}

      {/* Clerk renders its bot-protection widget here on web; skipped on native. */}
      <View nativeID="clerk-captcha" />
    </ScrollView>
  );
}
