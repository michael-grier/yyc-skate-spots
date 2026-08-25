import { useAuth } from "@clerk/expo";
import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { BoardMark } from "@/components/board-mark";
import { SpotForm } from "@/components/spot-form";
import { Button } from "@/components/ui/button";
import { EMPTY_SPOT_FORM } from "@/lib/spot-form";
import { colors } from "@/theme/colors";

/**
 * Add-spot tab. Signed-out users see a prompt; signed-in users get a fresh
 * form. Clerk state only gates the UI — api.spots.create re-checks identity.
 */
export default function AddSpotScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const createSpot = useMutation(api.spots.create);
  const moderation = useQuery(api.moderation.viewer, isSignedIn ? {} : "skip");
  // Bumped to remount a blank form after save or cancel.
  const [formKey, setFormKey] = useState(0);

  if (!isLoaded) {
    return (
      <View className="flex-1 items-center justify-center bg-base">
        <ActivityIndicator color={colors.mute} />
      </View>
    );
  }

  if (!isSignedIn) {
    return (
      <View className="flex-1 items-center justify-center bg-base px-8">
        <BoardMark size={40} color={colors.mute} />
        <Text className="mt-5 font-sans-semibold text-[17px] text-ink">Add a spot</Text>
        <Text className="mt-2 text-center font-sans text-[14px] text-mute">
          Sign in to put new spots on the map and manage the ones you add.
        </Text>
        <Button
          label="Sign in"
          onPress={() => router.push("/account")}
          className="mt-6 self-stretch"
        />
      </View>
    );
  }

  if (moderation === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-base">
        <ActivityIndicator color={colors.mute} />
      </View>
    );
  }

  if (moderation.isBanned) {
    return (
      <View className="flex-1 items-center justify-center bg-base px-8">
        <BoardMark size={40} color={colors.mute} />
        <Text className="mt-5 text-center font-sans-semibold text-[17px] text-ink">
          Adding spots is unavailable
        </Text>
        <Text className="mt-2 text-center font-sans text-[14px] leading-relaxed text-mute">
          Your contribution access was removed after repeated spots did not meet the standards. You
          can still browse the map and manage your existing spots.
        </Text>
        <Button
          label="Read the spot standards"
          onPress={() => router.push("/standards")}
          className="mt-6 self-stretch"
        />
      </View>
    );
  }

  return (
    <SpotForm
      key={formKey}
      title="New spot"
      initialValues={EMPTY_SPOT_FORM}
      onCancel={() => {
        setFormKey((k) => k + 1);
        router.navigate("/");
      }}
      onSave={async (payload, photoIds) => {
        const id = await createSpot({ ...payload, photoIds });
        setFormKey((k) => k + 1);
        router.push({ pathname: "/spot/[id]", params: { id } });
      }}
    />
  );
}
