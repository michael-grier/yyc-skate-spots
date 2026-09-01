import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

/** Converts the public /share?id= link into the existing spot detail route. */
export default function SharedSpotRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const spotId = typeof id === "string" && id.length > 0 ? id : null;

  if (spotId) {
    return <Redirect href={{ pathname: "/spot/[id]", params: { id: spotId } }} />;
  }

  return (
    <View className="flex-1 items-center justify-center bg-base px-8">
      <Stack.Screen options={{ headerShown: false }} />
      <Text className="font-sans-semibold text-[17px] text-ink">This share link is incomplete</Text>
      <Text className="mt-2 text-center font-sans text-[14px] text-mute">
        Ask the sender to share the spot again.
      </Text>
    </View>
  );
}
