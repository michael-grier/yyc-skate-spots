import { useAuth } from "@clerk/expo";
import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackIcon } from "@/components/icons";
import { ModerationReasonPicker } from "@/components/moderation-reason-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ReportReason } from "@/lib/spot-standards";
import { colors } from "@/theme/colors";

const MAX_DETAILS_LENGTH = 500;

/** Signed-in report form; the mutation independently checks identity and ownership. */
export default function ReportSpotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn } = useAuth();
  const spot = useQuery(api.spots.get, { id });
  const createReport = useMutation(api.reports.create);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason || spot?.status !== "active") {
      setError("Choose the reason that best describes the problem.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createReport({
        spotId: spot._id,
        reason,
        ...(details.trim() ? { details: details.trim() } : {}),
      });
      setSubmitted(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "The report could not be sent.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const header = (
    <View
      className="flex-row items-center gap-3 border-b border-white/10 px-5 pb-4"
      style={{ paddingTop: insets.top + 12 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={8}
        onPress={() => router.back()}
        className="h-9 w-9 items-center justify-center rounded-full border border-white/10 active:opacity-80"
      >
        <BackIcon size={18} color={colors.ink} />
      </Pressable>
      <Text className="font-sans-semibold text-[20px] tracking-tight text-ink">Report spot</Text>
    </View>
  );

  if (!isLoaded || spot === undefined) {
    return (
      <View className="flex-1 bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <ActivityIndicator color={colors.mute} className="mt-12" />
      </View>
    );
  }

  if (!isSignedIn) {
    return (
      <View className="flex-1 bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <View className="flex-1 justify-center px-8">
          <Text className="text-center font-sans-semibold text-[18px] text-ink">
            Sign in to report a spot
          </Text>
          <Text className="mt-2 text-center font-sans text-[14px] leading-relaxed text-mute">
            Reports stay private and are reviewed by the administrator.
          </Text>
          <Button label="Sign in" onPress={() => router.push("/account")} className="mt-6" />
        </View>
      </View>
    );
  }

  if (spot === null || spot.status !== "active" || spot.isOwner) {
    return (
      <View className="flex-1 bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <View className="flex-1 items-center justify-center px-8">
          <Text className="font-sans-semibold text-[17px] text-ink">Nothing to report here</Text>
          <Text className="mt-2 text-center font-sans text-[14px] text-mute">
            The spot is unavailable, or it belongs to you.
          </Text>
        </View>
      </View>
    );
  }

  if (submitted) {
    return (
      <View className="flex-1 bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <View className="flex-1 justify-center px-5">
          <Card className="p-5">
            <Text className="font-sans-medium text-[11px] text-mute">REPORT RECEIVED</Text>
            <Text className="mt-2 font-sans-semibold text-[22px] tracking-tight text-ink">
              Thanks for looking out
            </Text>
            <Text className="mt-3 font-sans text-[14px] leading-relaxed text-mute">
              Your report is private. The spot has been returned to the review queue for an admin
              decision.
            </Text>
          </Card>
          <Button label="Back to spot" onPress={() => router.back()} className="mt-4" />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-base">
      <Stack.Screen options={{ headerShown: false }} />
      {header}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: insets.bottom + 32,
          }}
        >
          <Text className="font-sans-semibold text-[18px] text-ink">{spot.name}</Text>
          <Text className="mt-1 font-sans text-[14px] leading-relaxed text-mute">
            Choose the closest reason. Reports are not shown to the contributor.
          </Text>

          <View className="mt-5">
            <ModerationReasonPicker
              value={reason}
              onChange={(selectedReason) => {
                setReason(selectedReason);
                setError(null);
              }}
            />
          </View>

          <Text className="mt-5 mb-2 px-1 font-sans-medium text-[11px] text-mute">
            DETAILS (OPTIONAL)
          </Text>
          <Card className="px-4 py-3">
            <TextInput
              value={details}
              onChangeText={setDetails}
              maxLength={MAX_DETAILS_LENGTH}
              placeholder="What should the admin know?"
              placeholderTextColor={colors.mute}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Report details"
              className="min-h-[96px] font-sans text-[14px] leading-relaxed text-ink"
              style={{ paddingVertical: 0 }}
            />
          </Card>
          <Text className="mt-1.5 px-1 text-right font-sans text-[11px] text-mute">
            {details.length}/{MAX_DETAILS_LENGTH}
          </Text>

          {error ? (
            <Text className="mt-3 font-sans text-[13px] text-bust-high">{error}</Text>
          ) : null}
          <Button
            label={submitting ? "Sending…" : "Send report"}
            onPress={() => void submit()}
            disabled={submitting}
            className="mt-4"
          />
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/standards")}
            className="mt-4 py-2 active:opacity-80"
          >
            <Text className="text-center font-sans-medium text-[13px] text-silver">
              Read the spot standards
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
