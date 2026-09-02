import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackIcon } from "@/components/icons";
import { PhotoCarousel } from "@/components/photo-carousel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMonthYear } from "@/lib/dates";
import { BUST_FACTOR_LABELS, SURFACE_LABELS, formatSpotTypes } from "@/lib/spot-labels";
import { reportReasonLabel } from "@/lib/spot-standards";
import { colors } from "@/theme/colors";

/** Admin-only review detail with private reports and explicit moderation decisions. */
export default function AdminSpotReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const viewer = useQuery(api.moderation.viewer);
  const isAdmin = viewer?.isAdmin === true;
  const spot = useQuery(api.moderation.getSpot, isAdmin ? { id } : "skip");
  const markMeetsStandards = useMutation(api.moderation.markMeetsStandards);
  const banContributor = useMutation(api.moderation.banContributor);
  const unbanContributor = useMutation(api.moderation.unbanContributor);
  const [working, setWorking] = useState(false);

  const backButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => router.back()}
      className="absolute left-4 h-9 w-9 items-center justify-center rounded-full border border-white/10 active:opacity-80"
      style={{ top: insets.top + 8, backgroundColor: "rgba(30,32,36,0.82)" }}
    >
      <BackIcon size={18} color={colors.ink} />
    </Pressable>
  );

  function confirmApproval() {
    if (!spot) return;
    const reportText =
      spot.reports.length === 0
        ? ""
        : ` and clear ${spot.reports.length} report${spot.reports.length === 1 ? "" : "s"}`;
    Alert.alert("Mark as meeting standards?", `This will finish the review${reportText}.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          setWorking(true);
          try {
            await markMeetsStandards({ spotId: spot._id });
            router.back();
          } catch {
            Alert.alert("Couldn't finish review", "Check your connection and try again.");
            setWorking(false);
          }
        },
      },
    ]);
  }

  function confirmContributorAccess() {
    const moderationUserId = spot?.creator.moderationId;
    if (!moderationUserId) return;
    const restoring = spot.creator.isBanned;
    Alert.alert(
      restoring ? "Restore contribution access?" : "Ban this contributor?",
      restoring
        ? "They will be able to add and edit spots again. Their removal count will not change."
        : "They will still be able to sign in, browse, and delete their spots.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: restoring ? "Restore" : "Ban",
          style: restoring ? "default" : "destructive",
          onPress: async () => {
            setWorking(true);
            try {
              const args = { moderationUserId };
              if (restoring) {
                await unbanContributor(args);
              } else {
                await banContributor(args);
              }
            } catch {
              Alert.alert("Couldn't update access", "Check your connection and try again.");
            } finally {
              setWorking(false);
            }
          },
        },
      ],
    );
  }

  if (viewer === undefined || (isAdmin && spot === undefined)) {
    return (
      <View className="flex-1 items-center justify-center bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.mute} />
        {backButton}
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View className="flex-1 items-center justify-center bg-base px-8">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="font-sans-semibold text-[17px] text-ink">Administrator access only</Text>
        {backButton}
      </View>
    );
  }

  if (spot === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.mute} />
        {backButton}
      </View>
    );
  }

  if (spot === null) {
    return (
      <View className="flex-1 items-center justify-center bg-base px-8">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="font-sans-semibold text-[17px] text-ink">This spot is gone</Text>
        <Text className="mt-2 text-center font-sans text-[14px] text-mute">
          It may already have been removed or deleted.
        </Text>
        {backButton}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-base">
      <Stack.Screen options={{ headerShown: false }} />
      {/* Keep the first photo clear of system status-bar content, as the public screen does. */}
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 32 }}
      >
        <PhotoCarousel urls={spot.photoUrls} spotName={spot.name} />
        <View className="px-5">
          <View className="flex-row items-center gap-2">
            <View
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor:
                  spot.reports.length > 0
                    ? colors.bust.high
                    : spot.review.needsReview
                      ? colors.bust.medium
                      : colors.bust.low,
              }}
            />
            <Text className="font-sans-semibold text-[11px] text-mute">
              {spot.reports.length > 0
                ? `${spot.reports.length} OPEN REPORT${spot.reports.length === 1 ? "" : "S"}`
                : spot.review.needsReview
                  ? spot.review.attentionReason === "edited"
                    ? "EDITED · NEEDS REVIEW"
                    : "NEW · NEEDS REVIEW"
                  : "REVIEWED"}
            </Text>
          </View>
          <Text className="mt-2 font-sans-semibold text-[26px] tracking-tight text-ink">
            {spot.name}
          </Text>
          <Text className="mt-1 font-sans text-[13px] text-mute">
            {formatSpotTypes(spot.types)} · {BUST_FACTOR_LABELS[spot.bustFactor]} bust
            {spot.surface ? ` · ${SURFACE_LABELS[spot.surface]} surface` : ""}
          </Text>
          <Text className="mt-1 font-sans text-[12px] text-mute">
            {spot.latitude.toFixed(5)}, {spot.longitude.toFixed(5)} · Added{" "}
            {formatMonthYear(spot._creationTime)}
          </Text>
          {spot.notes ? (
            <Text className="mt-4 font-sans text-[14px] leading-relaxed text-ink/90">
              {spot.notes}
            </Text>
          ) : null}

          <Text className="mt-7 mb-2 px-1 font-sans-medium text-[11px] text-mute">
            REPORTS ({spot.reports.length})
          </Text>
          {spot.reports.length > 0 ? (
            <View className="gap-2">
              {spot.reports.map((report) => (
                <Card key={report._id} className="border-bust-high/30 p-4">
                  <Text className="font-sans-semibold text-[14px] text-ink">
                    {reportReasonLabel(report.reason)}
                  </Text>
                  {report.details ? (
                    <Text className="mt-1 font-sans text-[13px] leading-relaxed text-mute">
                      {report.details}
                    </Text>
                  ) : null}
                  <Text className="mt-2 font-sans text-[11px] text-mute">
                    Reported {formatMonthYear(report._creationTime)}
                  </Text>
                </Card>
              ))}
            </View>
          ) : (
            <Card className="p-4">
              <Text className="font-sans-semibold text-[14px] text-ink">No user reports</Text>
              <Text className="mt-1 font-sans text-[12px] leading-relaxed text-mute">
                {spot.review.needsReview
                  ? "This spot is in the proactive queue because it is new or was edited."
                  : "This version already passed review."}
              </Text>
            </Card>
          )}

          <Text className="mt-7 mb-2 px-1 font-sans-medium text-[11px] text-mute">CONTRIBUTOR</Text>
          <Card className="p-4">
            <View className="flex-row items-start gap-3">
              <View className="flex-1">
                <Text className="font-sans-semibold text-[15px] text-ink">
                  {spot.creator.name ?? "Unknown contributor"}
                </Text>
                <Text className="mt-1 font-sans text-[12px] text-mute">
                  {spot.creator.confirmedRemovalCount} confirmed removal
                  {spot.creator.confirmedRemovalCount === 1 ? "" : "s"}
                  {spot.creator.isBanned ? " · contribution access removed" : ""}
                </Text>
              </View>
              {spot.creator.moderationId &&
              (spot.creator.isBanned || spot.creator.confirmedRemovalCount >= 3) ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={working}
                  onPress={confirmContributorAccess}
                  className="rounded-full border border-white/15 px-3 py-2 active:opacity-80 disabled:opacity-40"
                >
                  <Text className="font-sans-semibold text-[12px] text-silver">
                    {spot.creator.isBanned ? "Restore" : "Ban"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </Card>

          <Text className="mt-7 mb-2 px-1 font-sans-medium text-[11px] text-mute">DECISION</Text>
          <Card className="p-4">
            <Text className="font-sans-semibold text-[15px] text-ink">Finish this review</Text>
            <Text className="mt-1 font-sans text-[12px] leading-relaxed text-mute">
              Approving publishes the current version and clears its reports. Removal deletes the
              spot and records one confirmed violation.
            </Text>
            <Button
              label={working ? "Working…" : "Meets standards"}
              onPress={confirmApproval}
              disabled={working}
              className="mt-4"
            />
            <Button
              label="Remove spot"
              variant="danger"
              disabled={working}
              onPress={() =>
                router.push({ pathname: "/admin/spot/remove/[id]", params: { id: spot._id } })
              }
              className="mt-2"
            />
          </Card>

          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/standards")}
            className="mt-4 py-2 active:opacity-80"
          >
            <Text className="text-center font-sans-medium text-[13px] text-silver">
              Read the spot standards
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      {backButton}
    </View>
  );
}
