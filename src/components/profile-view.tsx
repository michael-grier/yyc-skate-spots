import { useClerk, useUser } from "@clerk/expo";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChevronRightIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { BUST_FACTOR_COLORS, BUST_FACTOR_LABELS, formatSpotTypes } from "@/lib/spot-labels";
import { reportReasonLabel } from "@/lib/spot-standards";
import { colors } from "@/theme/colors";

function initialsOf(name: string | null | undefined, email: string | undefined) {
  const source = name?.trim() || email || "";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

type ProfileList = "favorites" | "mine";
type ProfileSpot = FunctionReturnType<typeof api.spots.mine>[number];

type ProfileSegmentProps = {
  label: string;
  count: number | undefined;
  selected: boolean;
  onPress: () => void;
};

/** One half of the profile's Favourites / Your spots switcher. */
function ProfileSegment({ label, count, selected, onPress }: ProfileSegmentProps) {
  const countLabel = count === undefined ? "loading" : `${count} ${count === 1 ? "spot" : "spots"}`;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={`${label}, ${countLabel}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={cn("flex-1 rounded-xl px-3 py-2.5", selected && "bg-white/10")}
    >
      <Text
        className={cn(
          "text-center text-[13px]",
          selected ? "font-sans-semibold text-ink" : "font-sans-medium text-mute",
        )}
      >
        {label} <Text className="text-mute">{count ?? "…"}</Text>
      </Text>
    </Pressable>
  );
}

/** Signed-in Account tab with saved and submitted spot lists. */
export function ProfileView() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const favorites = useQuery(api.favorites.list);
  const mySpots = useQuery(api.spots.mine);
  const [activeList, setActiveList] = useState<ProfileList>("favorites");
  const moderation = useQuery(api.moderation.viewer);
  const email = user?.primaryEmailAddress?.emailAddress;
  const activeSpots: ProfileSpot[] | undefined =
    activeList === "favorites"
      ? favorites?.map((spot) => ({ status: "active" as const, ...spot }))
      : mySpots;
  const emptyMessage =
    activeList === "favorites"
      ? "No favourites yet. Tap the heart on a spot to save it here."
      : "Nothing yet. Spots you add from the Add tab show up here.";

  return (
    <FlatList
      className="flex-1 bg-base"
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + 24,
      }}
      data={activeSpots ?? []}
      keyExtractor={(spot) => spot._id}
      extraData={activeList}
      ListHeaderComponent={
        <>
          <Text className="font-sans-semibold text-[26px] tracking-tight text-ink">Profile</Text>
          <Card className="mt-6 flex-row items-center gap-4 p-4">
            <View className="h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <Text className="font-sans-semibold text-[15px] text-silver">
                {initialsOf(user?.fullName, email)}
              </Text>
            </View>
            <View className="flex-1">
              {user?.fullName ? (
                <Text numberOfLines={1} className="font-sans-semibold text-[16px] text-ink">
                  {user.fullName}
                </Text>
              ) : null}
              {email ? (
                <Text numberOfLines={1} className="font-sans text-[13px] text-mute">
                  {email}
                </Text>
              ) : null}
            </View>
          </Card>

          {moderation?.isAdmin ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/admin")}
              className="mt-3 active:opacity-90"
            >
              <Card className="flex-row items-center gap-3 p-4">
                <View className="flex-1">
                  <Text className="font-sans-semibold text-[15px] text-ink">Review spots</Text>
                  <Text className="mt-1 font-sans text-[12px] text-mute">
                    Check recent submissions, reports, and ban eligibility.
                  </Text>
                </View>
                <ChevronRightIcon size={18} color={colors.mute} />
              </Card>
            </Pressable>
          ) : null}

          {moderation?.isBanned ? (
            <Card className="mt-3 p-4">
              <Text className="font-sans-semibold text-[15px] text-ink">
                Contribution access removed
              </Text>
              <Text className="mt-1 font-sans text-[13px] leading-relaxed text-mute">
                You can browse and delete your existing spots, but you cannot add or edit spots.
              </Text>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push("/standards")}
                className="mt-2 self-start py-1 active:opacity-80"
              >
                <Text className="font-sans-semibold text-[13px] text-silver">
                  Read the spot standards
                </Text>
              </Pressable>
            </Card>
          ) : null}

          <View className="mt-7 flex-row rounded-2xl border border-white/10 bg-card p-1">
            <ProfileSegment
              label="Favourites"
              count={favorites?.length}
              selected={activeList === "favorites"}
              onPress={() => setActiveList("favorites")}
            />
            <ProfileSegment
              label="Your spots"
              count={mySpots?.length}
              selected={activeList === "mine"}
              onPress={() => setActiveList("mine")}
            />
          </View>

          {activeSpots === undefined ? (
            <ActivityIndicator
              accessibilityLabel={`Loading ${activeList === "favorites" ? "favourites" : "your spots"}`}
              color={colors.mute}
              className="mt-4 self-start px-1"
            />
          ) : null}
          {activeSpots?.length === 0 ? (
            <Text className="mt-4 px-1 font-sans text-[14px] text-mute">{emptyMessage}</Text>
          ) : null}
          {activeSpots && activeSpots.length > 0 ? <View className="h-4" /> : null}
        </>
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/spot/[id]", params: { id: item._id } })}
          className="active:opacity-90"
        >
          <Card className="mb-2 flex-row items-center gap-3 px-4 py-3">
            <View className="flex-1">
              <Text numberOfLines={1} className="font-sans-semibold text-[15px] text-ink">
                {item.name}
              </Text>
              {"status" in item && item.status === "removed" ? (
                <View className="mt-1">
                  <Text className="font-sans text-[12px]" style={{ color: colors.bust.high }}>
                    Removed · {reportReasonLabel(item.reason)}
                  </Text>
                  <Text className="mt-0.5 font-sans text-[11px] text-mute">
                    Confirmed removal {item.strikeNumber} · ban threshold 3
                  </Text>
                </View>
              ) : (
                <View className="mt-1 flex-row items-center gap-1.5">
                  <View
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: BUST_FACTOR_COLORS[item.bustFactor] }}
                  />
                  <Text numberOfLines={1} className="font-sans text-[12px] text-mute">
                    {formatSpotTypes(item.types)} · {BUST_FACTOR_LABELS[item.bustFactor]} bust
                  </Text>
                </View>
              )}
            </View>
            <ChevronRightIcon size={18} color={colors.mute} />
          </Card>
        </Pressable>
      )}
      ListFooterComponent={
        <Button label="Sign out" onPress={() => void signOut()} className="mt-6" />
      }
    />
  );
}
