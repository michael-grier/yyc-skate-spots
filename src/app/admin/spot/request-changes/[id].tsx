import { api } from "@convex/_generated/api";
import { MAX_CHANGES_MESSAGE_LENGTH, MIN_CHANGES_MESSAGE_LENGTH } from "@convex/constants";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRevealFieldOnKeyboard } from "@/lib/use-reveal-field-on-keyboard";
import { colors } from "@/theme/colors";

/** Sends a spot waiting for review back to its owner with a message, instead of removing it. */
export default function AdminRequestChangesScreen() {
  // The version the review screen showed. The form's own query updates live, so deciding on it
  // could land on an edit the admin never looked at.
  const { id, version } = useLocalSearchParams<{ id: string; version?: string }>();
  const reviewedVersion = version === undefined ? undefined : Number(version);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const viewer = useQuery(api.moderation.viewer);
  const isAdmin = viewer?.isAdmin === true;
  const spot = useQuery(api.moderation.getSpot, isAdmin ? { id } : "skip");
  const requestChanges = useMutation(api.moderation.requestChanges);
  const [message, setMessage] = useState("");
  const { scrollRef, onFieldLayout } = useRevealFieldOnKeyboard();
  const [working, setWorking] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <Text className="font-sans-semibold text-[20px] tracking-tight text-ink">
        Request changes
      </Text>
    </View>
  );

  async function send() {
    if (!spot) return;
    const trimmed = message.trim();
    if (trimmed.length < MIN_CHANGES_MESSAGE_LENGTH) {
      setError("Say what to change, so the contributor knows how to fix it.");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await requestChanges({
        spotId: spot._id,
        expectedReviewVersion: reviewedVersion,
        message: trimmed,
      });
      setSent(true);
    } catch {
      // Production hides the server's reason, which may be a stale-screen refusal.
      setError(
        "Couldn't send it. The spot may have changed while you were writing; go back and check it.",
      );
    } finally {
      setWorking(false);
    }
  }

  // Checked first: sending changes the spot this screen loaded.
  if (sent) {
    return (
      <View className="flex-1 bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <View className="flex-1 justify-center px-5">
          <Card className="p-5">
            <Text className="font-sans-medium text-[11px] text-mute">CHANGES REQUESTED</Text>
            <Text className="mt-2 font-sans-semibold text-[22px] tracking-tight text-ink">
              Sent back
            </Text>
            <Text className="mt-3 font-sans text-[14px] leading-relaxed text-mute">
              No strike added. The contributor gets your message in Updates, and the spot comes back
              to the queue when they resubmit.
            </Text>
          </Card>
          <Button
            label="Back to review queue"
            onPress={() => router.replace("/admin")}
            className="mt-4"
          />
        </View>
      </View>
    );
  }

  if (viewer === undefined || (isAdmin && spot === undefined)) {
    return (
      <View className="flex-1 bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <ActivityIndicator color={colors.mute} className="mt-12" />
      </View>
    );
  }

  if (!isAdmin || !spot) {
    return (
      <View className="flex-1 bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <View className="flex-1 items-center justify-center px-8">
          <Text className="font-sans-semibold text-[17px] text-ink">
            {isAdmin ? "This spot is gone" : "Administrator access only"}
          </Text>
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
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: insets.bottom + 32,
          }}
        >
          <Card className="border-bust-medium/30 p-4">
            <Text className="font-sans-medium text-[11px] text-bust-medium">SENDING BACK</Text>
            <Text className="mt-1 font-sans-semibold text-[18px] text-ink">{spot.name}</Text>
            <Text className="mt-2 font-sans text-[13px] leading-relaxed text-mute">
              It stays off the map, and the contributor can edit and resubmit it. No strike is
              added.
            </Text>
          </Card>

          <View onLayout={onFieldLayout()}>
            <Text className="mt-5 mb-2 px-1 font-sans-medium text-[11px] text-mute">
              MESSAGE TO CONTRIBUTOR
            </Text>
            <Card className="px-4 py-3">
              <TextInput
                value={message}
                onChangeText={(text) => {
                  setMessage(text);
                  setError(null);
                }}
                maxLength={MAX_CHANGES_MESSAGE_LENGTH}
                placeholder="What needs to change before it can go on the map?"
                placeholderTextColor={colors.mute}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Message to contributor"
                accessibilityHint="The contributor sees this word for word"
                className="min-h-[120px] max-h-[200px] font-sans text-[14px] leading-relaxed text-ink"
                style={{ paddingVertical: 0 }}
              />
            </Card>
            <View className="mt-1.5 flex-row justify-between px-1">
              <Text className="font-sans text-[11px] text-mute">
                Say exactly what to fix. They’ll see this word for word.
              </Text>
              <Text className="font-sans text-[11px] text-mute">
                {message.length}/{MAX_CHANGES_MESSAGE_LENGTH}
              </Text>
            </View>
          </View>

          {error ? (
            <Text className="mt-3 font-sans text-[13px] text-bust-high">{error}</Text>
          ) : null}
          <Button
            label={working ? "Sending…" : "Send to contributor"}
            disabled={working}
            onPress={() => void send()}
            className="mt-4"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
