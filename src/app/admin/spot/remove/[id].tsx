import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
type RemovalResult = FunctionReturnType<typeof api.moderation.removeSpot>;

/** Final admin removal form, separated from review so deletion requires an explicit reason. */
export default function AdminRemoveSpotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const viewer = useQuery(api.moderation.viewer);
  const isAdmin = viewer?.isAdmin === true;
  const spot = useQuery(api.moderation.getSpot, isAdmin ? { id } : "skip");
  const removeSpot = useMutation(api.moderation.removeSpot);
  const banContributor = useMutation(api.moderation.banContributor);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<RemovalResult | null>(null);
  const [banApplied, setBanApplied] = useState(false);
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
      <Text className="font-sans-semibold text-[20px] tracking-tight text-ink">Remove spot</Text>
    </View>
  );

  function confirmRemoval() {
    if (!reason || !spot) {
      setError("Choose the reason for removal.");
      return;
    }
    Alert.alert(
      `Remove ${spot.name}?`,
      "The spot and its photos will be deleted. The contributor will receive a private removal notice.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setWorking(true);
            setError(null);
            try {
              setResult(
                await removeSpot({
                  spotId: spot._id,
                  reason,
                  ...(details.trim() ? { details: details.trim() } : {}),
                }),
              );
            } catch (removeError) {
              setError(
                removeError instanceof Error
                  ? removeError.message
                  : "The spot could not be removed.",
              );
            } finally {
              setWorking(false);
            }
          },
        },
      ],
    );
  }

  function confirmBan() {
    if (!result?.contributorModerationId) return;
    const moderationUserId = result.contributorModerationId;
    Alert.alert(
      "Ban this contributor?",
      "They will still be able to sign in, browse, and delete their remaining spots.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Ban",
          style: "destructive",
          onPress: async () => {
            setWorking(true);
            try {
              await banContributor({ moderationUserId });
              setBanApplied(true);
            } catch {
              Alert.alert("Couldn't ban contributor", "Check your connection and try again.");
            } finally {
              setWorking(false);
            }
          },
        },
      ],
    );
  }

  if (viewer === undefined || (isAdmin && spot === undefined && result === null)) {
    return (
      <View className="flex-1 bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <ActivityIndicator color={colors.mute} className="mt-12" />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View className="flex-1 bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <View className="flex-1 items-center justify-center px-8">
          <Text className="font-sans-semibold text-[17px] text-ink">Administrator access only</Text>
        </View>
      </View>
    );
  }

  if (result) {
    return (
      <View className="flex-1 bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 20,
            paddingVertical: 24,
          }}
        >
          <Card className="p-5">
            <Text className="font-sans-medium text-[11px] text-mute">SPOT REMOVED</Text>
            <Text className="mt-2 font-sans-semibold text-[22px] tracking-tight text-ink">
              Review complete
            </Text>
            <Text className="mt-3 font-sans text-[14px] leading-relaxed text-mute">
              {result.strikeCount > 0
                ? `The spot is no longer public. This is confirmed removal ${result.strikeCount} for the contributor.`
                : "The spot is no longer public. Seed listings do not count toward a contributor."}
            </Text>
          </Card>

          {result.eligibleForBan && result.contributorModerationId ? (
            <Card className="mt-3 border-bust-high/30 p-5">
              <Text className="font-sans-semibold text-[16px] text-ink">
                {banApplied ? "Contribution access removed" : "Contributor is eligible for a ban"}
              </Text>
              <Text className="mt-1 font-sans text-[13px] leading-relaxed text-mute">
                {banApplied
                  ? "They can still sign in, browse, and delete their remaining spots."
                  : "The threshold is three confirmed removals. The ban remains a separate manual decision."}
              </Text>
              {!banApplied ? (
                <Button
                  label={working ? "Banning…" : "Ban contributor"}
                  variant="danger"
                  disabled={working}
                  onPress={confirmBan}
                  className="mt-4"
                />
              ) : null}
            </Card>
          ) : null}

          <Button
            label="Back to review queue"
            onPress={() => router.replace("/admin")}
            className="mt-4"
          />
        </ScrollView>
      </View>
    );
  }

  if (spot === undefined) {
    return (
      <View className="flex-1 bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <ActivityIndicator color={colors.mute} className="mt-12" />
      </View>
    );
  }

  if (spot === null) {
    return (
      <View className="flex-1 bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <View className="flex-1 items-center justify-center px-8">
          <Text className="font-sans-semibold text-[17px] text-ink">This spot is gone</Text>
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
          <Card className="border-bust-high/30 p-4">
            <Text className="font-sans-medium text-[11px] text-bust-high">REMOVING</Text>
            <Text className="mt-1 font-sans-semibold text-[18px] text-ink">{spot.name}</Text>
            <Text className="mt-2 font-sans text-[13px] leading-relaxed text-mute">
              Choose the standard this spot failed. This reason appears in the contributor’s private
              removal notice.
            </Text>
          </Card>

          <Text className="mt-5 mb-2 px-1 font-sans-medium text-[11px] text-mute">
            REMOVAL REASON
          </Text>
          <ModerationReasonPicker
            value={reason}
            onChange={(selectedReason) => {
              setReason(selectedReason);
              setError(null);
            }}
          />

          <Text className="mt-5 mb-2 px-1 font-sans-medium text-[11px] text-mute">
            INTERNAL DETAILS (OPTIONAL)
          </Text>
          <Card className="px-4 py-3">
            <TextInput
              value={details}
              onChangeText={setDetails}
              maxLength={MAX_DETAILS_LENGTH}
              placeholder="Notes for the moderation record"
              placeholderTextColor={colors.mute}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Internal removal details"
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
            label={working ? "Removing…" : "Remove spot"}
            variant="danger"
            disabled={working}
            onPress={confirmRemoval}
            className="mt-4"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
