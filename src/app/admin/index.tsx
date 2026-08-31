import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { useMutation, useQuery } from "convex/react";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BoardMark } from "@/components/board-mark";
import { BackIcon, ChevronRightIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { formatMonthYear } from "@/lib/dates";
import { formatSpotTypes } from "@/lib/spot-labels";
import { colors } from "@/theme/colors";

type QueueFilter = "needs_review" | "reported" | "all";
type QueueSpot = FunctionReturnType<typeof api.moderation.listSpots>[number];

const FILTERS: { value: QueueFilter; label: string }[] = [
  { value: "needs_review", label: "Needs review" },
  { value: "reported", label: "Reported" },
  { value: "all", label: "All" },
];

function reviewLabel(spot: QueueSpot) {
  if (spot.review.openReportCount > 0) {
    return `${spot.review.openReportCount} report${spot.review.openReportCount === 1 ? "" : "s"}`;
  }
  if (!spot.review.needsReview) {
    return "Reviewed";
  }
  return spot.review.attentionReason === "edited" ? "Edited" : "New";
}

function reviewColor(spot: QueueSpot) {
  if (spot.review.openReportCount > 0) return colors.bust.high;
  if (!spot.review.needsReview) return colors.bust.low;
  return colors.bust.medium;
}

/** Photo-led row from the approved queue direction. */
function QueueSpotCard({ spot, onPress }: { spot: QueueSpot; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Review ${spot.name}, ${reviewLabel(spot)}`}
      onPress={onPress}
      className="mb-3 active:opacity-90"
    >
      <Card className="flex-row overflow-hidden p-0">
        {spot.previewPhotoUrl ? (
          <Image
            source={{ uri: spot.previewPhotoUrl }}
            contentFit="cover"
            accessibilityLabel={`${spot.name} preview`}
            className="h-28 w-28"
          />
        ) : (
          <View className="h-28 w-28 items-center justify-center bg-white/5">
            <BoardMark size={38} color={colors.mute} />
          </View>
        )}
        <View className="flex-1 justify-center px-4 py-3">
          <View className="mb-2 flex-row items-center gap-2">
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: reviewColor(spot) }} />
            <Text className="font-sans-semibold text-[11px] text-mute">{reviewLabel(spot)}</Text>
          </View>
          <Text numberOfLines={1} className="font-sans-semibold text-[16px] text-ink">
            {spot.name}
          </Text>
          <Text numberOfLines={1} className="mt-1 font-sans text-[12px] text-mute">
            {formatSpotTypes(spot.types)} · {spot.creatorName ?? "Unknown contributor"}
          </Text>
          <Text className="mt-1 font-sans text-[11px] text-mute">
            Added {formatMonthYear(spot._creationTime)}
          </Text>
        </View>
        <View className="justify-center pr-3">
          <ChevronRightIcon size={18} color={colors.mute} />
        </View>
      </Card>
    </Pressable>
  );
}

/** Admin-only proactive queue, newest first, with a reported-only filter. */
export default function AdminQueueScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const viewer = useQuery(api.moderation.viewer);
  const isAdmin = viewer?.isAdmin === true;
  const spots = useQuery(api.moderation.listSpots, isAdmin ? {} : "skip");
  const eligibleContributors = useQuery(
    api.moderation.listEligibleContributors,
    isAdmin ? {} : "skip",
  );
  const banContributor = useMutation(api.moderation.banContributor);
  const [filter, setFilter] = useState<QueueFilter>("needs_review");
  const [banningId, setBanningId] = useState<string | null>(null);

  const filteredSpots = useMemo(() => {
    if (!spots) return [];
    if (filter === "reported") return spots.filter((spot) => spot.review.openReportCount > 0);
    if (filter === "needs_review") return spots.filter((spot) => spot.review.needsReview);
    return spots;
  }, [filter, spots]);

  function confirmBan(contributor: NonNullable<typeof eligibleContributors>[number]) {
    const name = contributor.name ?? "this contributor";
    Alert.alert(
      `Ban ${name}?`,
      "They will still be able to sign in, browse, and delete their spots, but cannot add or edit spots.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Ban",
          style: "destructive",
          onPress: async () => {
            setBanningId(contributor._id);
            try {
              await banContributor({ moderationUserId: contributor._id });
            } catch {
              Alert.alert("Couldn't ban contributor", "Check your connection and try again.");
            } finally {
              setBanningId(null);
            }
          },
        },
      ],
    );
  }

  if (viewer === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.mute} />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View className="flex-1 items-center justify-center bg-base px-8">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="font-sans-semibold text-[17px] text-ink">Administrator access only</Text>
        <Text className="mt-2 text-center font-sans text-[14px] text-mute">
          This review queue is not available for your account.
        </Text>
        <Button label="Back" onPress={() => router.back()} className="mt-6 self-stretch" />
      </View>
    );
  }

  const reportedCount = spots?.filter((spot) => spot.review.openReportCount > 0).length ?? 0;
  const needsReviewCount = spots?.filter((spot) => spot.review.needsReview).length ?? 0;

  return (
    <View className="flex-1 bg-base">
      <Stack.Screen options={{ headerShown: false }} />
      <FlatList
        data={filteredSpots}
        keyExtractor={(spot) => spot._id}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 32,
        }}
        ListHeaderComponent={
          <View>
            <View className="flex-row items-center gap-3">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={8}
                onPress={() => router.back()}
                className="h-9 w-9 items-center justify-center rounded-full border border-white/10 active:opacity-80"
              >
                <BackIcon size={18} color={colors.ink} />
              </Pressable>
              <View>
                <Text className="font-sans-semibold text-[24px] tracking-tight text-ink">
                  Spot review
                </Text>
                <Text className="font-sans text-[12px] text-mute">Newest spots first</Text>
              </View>
            </View>

            {eligibleContributors && eligibleContributors.length > 0 ? (
              <Card className="mt-5 p-4">
                <Text className="font-sans-semibold text-[15px] text-ink">
                  Eligible for a contribution ban
                </Text>
                <Text className="mt-1 font-sans text-[12px] leading-relaxed text-mute">
                  These contributors have at least three confirmed removals. Bans remain manual.
                </Text>
                <View className="mt-3 gap-3">
                  {eligibleContributors.map((contributor) => (
                    <View key={contributor._id} className="flex-row items-center gap-3">
                      <View className="flex-1">
                        <Text className="font-sans-semibold text-[13px] text-ink">
                          {contributor.name ?? "Unknown contributor"}
                        </Text>
                        <Text className="font-sans text-[11px] text-mute">
                          {contributor.confirmedRemovalCount} confirmed removals
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        disabled={banningId === contributor._id}
                        onPress={() => confirmBan(contributor)}
                        className="rounded-full border border-bust-high/40 px-3 py-2 active:opacity-80 disabled:opacity-40"
                      >
                        <Text className="font-sans-semibold text-[12px] text-bust-high">
                          {banningId === contributor._id ? "Banning…" : "Ban"}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </Card>
            ) : null}

            <View className="mt-5 mb-4 flex-row gap-2">
              {FILTERS.map((option) => {
                const count =
                  option.value === "reported"
                    ? reportedCount
                    : option.value === "needs_review"
                      ? needsReviewCount
                      : spots?.length;
                return (
                  <Chip
                    key={option.value}
                    label={`${option.label}${count === undefined ? "" : ` ${count}`}`}
                    selected={filter === option.value}
                    onPress={() => setFilter(option.value)}
                    className="flex-1 px-2"
                  />
                );
              })}
            </View>

            {spots === undefined ? (
              <ActivityIndicator color={colors.mute} className="mb-5" />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <QueueSpotCard
            spot={item}
            onPress={() => router.push({ pathname: "/admin/spot/[id]", params: { id: item._id } })}
          />
        )}
        ListEmptyComponent={
          spots === undefined ? null : (
            <Card className="items-center p-6">
              <Text className="font-sans-semibold text-[15px] text-ink">Queue is clear</Text>
              <Text className="mt-1 text-center font-sans text-[13px] text-mute">
                No spots match this filter.
              </Text>
            </Card>
          )
        }
      />
    </View>
  );
}
