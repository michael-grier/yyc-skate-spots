import { Stack, useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { SPOT_STANDARDS } from "@/lib/spot-standards";
import { colors } from "@/theme/colors";

/** Public policy used for submissions, reports, and moderation decisions. */
export default function SpotStandardsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-base">
      <Stack.Screen options={{ headerShown: false }} />
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
          Spot standards
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: insets.bottom + 32,
        }}
      >
        <Text className="font-sans text-[15px] leading-relaxed text-mute">
          YYC Skate Spots is a practical map of real street spots. Every listing should meet all of
          these standards.
        </Text>
        <View className="mt-5 gap-3">
          {SPOT_STANDARDS.map((standard, index) => (
            <Card key={standard.title} className="flex-row gap-4 p-4">
              <View className="h-7 w-7 items-center justify-center rounded-full bg-white/5">
                <Text className="font-sans-semibold text-[12px] text-silver">{index + 1}</Text>
              </View>
              <View className="flex-1">
                <Text className="font-sans-semibold text-[15px] text-ink">{standard.title}</Text>
                <Text className="mt-1 font-sans text-[13px] leading-relaxed text-mute">
                  {standard.description}
                </Text>
              </View>
            </Card>
          ))}
        </View>
        <Text className="mt-5 px-1 font-sans text-[12px] leading-relaxed text-mute">
          New spots and edits stay private until an administrator approves them. Reports are private
          and return a spot to the review queue so an administrator can approve it or remove it.
        </Text>
        <Text className="mt-3 px-1 font-sans text-[12px] leading-relaxed text-mute">
          A confirmed removal counts toward the contributor’s moderation record. After three
          confirmed removals, an administrator may block that account from adding spots, editing,
          uploading photos, or sending reports.
        </Text>
      </ScrollView>
    </View>
  );
}
