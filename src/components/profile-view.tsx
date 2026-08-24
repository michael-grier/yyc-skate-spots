import { useClerk, useUser } from "@clerk/expo";
import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChevronRightIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BUST_FACTOR_COLORS, BUST_FACTOR_LABELS, formatSpotTypes } from "@/lib/spot-labels";
import { colors } from "@/theme/colors";

function initialsOf(name: string | null | undefined, email: string | undefined) {
  const source = name?.trim() || email || "";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

/** Signed-in state of the Account tab: who you are, and the spots you've added. */
export function ProfileView() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const mySpots = useQuery(api.spots.mine);
  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <FlatList
      className="flex-1 bg-base"
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + 24,
      }}
      data={mySpots ?? []}
      keyExtractor={(spot) => spot._id}
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

          <Text className="mt-8 mb-2 px-1 font-sans-medium text-[11px] text-mute">YOUR SPOTS</Text>
          {mySpots === undefined ? (
            <ActivityIndicator color={colors.mute} className="self-start px-1" />
          ) : null}
          {mySpots?.length === 0 ? (
            <Text className="px-1 font-sans text-[14px] text-mute">
              Nothing yet. Spots you add from the Add tab show up here.
            </Text>
          ) : null}
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
              <View className="mt-1 flex-row items-center gap-1.5">
                <View
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: BUST_FACTOR_COLORS[item.bustFactor] }}
                />
                <Text numberOfLines={1} className="font-sans text-[12px] text-mute">
                  {formatSpotTypes(item.types)} · {BUST_FACTOR_LABELS[item.bustFactor]} bust
                </Text>
              </View>
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
