import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";

import { SpotForm } from "@/components/spot-form";
import { Button } from "@/components/ui/button";
import { spotToFormValues } from "@/lib/spot-form";
import { colors } from "@/theme/colors";

/** Owner-only edit screen; api.spots.update enforces ownership server-side. */
export default function EditSpotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const spotId = id as Id<"spots">;
  const spot = useQuery(api.spots.get, { id: spotId });
  const updateSpot = useMutation(api.spots.update);

  if (spot === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.mute} />
      </View>
    );
  }

  // photoIds is only returned to the owner, so its absence doubles as the guard.
  if (spot === null || !spot.isOwner || spot.photoIds === null) {
    return (
      <View className="flex-1 items-center justify-center bg-base px-8">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="font-sans-semibold text-[17px] text-ink">Nothing to edit here</Text>
        <Text className="mt-2 text-center font-sans text-[14px] text-mute">
          Only the person who added a spot can change it.
        </Text>
        <Button label="Back" onPress={() => router.back()} className="mt-6 self-stretch" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SpotForm
        title="Edit spot"
        initialValues={spotToFormValues({ ...spot, photoIds: spot.photoIds })}
        onCancel={() => router.back()}
        onSave={async (payload, photoIds) => {
          await updateSpot({ id: spotId, ...payload, photoIds });
          router.back();
        }}
      />
    </>
  );
}
