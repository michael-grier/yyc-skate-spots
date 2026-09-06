import { Alert, Linking, Pressable, Text, View } from "react-native";

import { cn } from "@/lib/cn";
import { publicSiteUrl, type PublicSitePage } from "@/lib/public-site";

type PublicSiteLinksProps = {
  onOpenStandards: () => void;
  className?: string;
};

/** Compact access to the public policies from either signed-in account state. */
export function PublicSiteLinks({ onOpenStandards, className }: PublicSiteLinksProps) {
  async function openPage(page: PublicSitePage) {
    try {
      await Linking.openURL(publicSiteUrl(page));
    } catch {
      Alert.alert("Couldn’t open the website", "Check your connection and try again.");
    }
  }

  return (
    <View className={cn("flex-row flex-wrap justify-center gap-x-4 gap-y-2", className)}>
      <Pressable
        accessibilityRole="link"
        onPress={() => void openPage("privacy")}
        className="min-h-11 justify-center active:opacity-70"
      >
        <Text className="font-sans text-[12px] text-mute">Privacy</Text>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        onPress={() => void openPage("support")}
        className="min-h-11 justify-center active:opacity-70"
      >
        <Text className="font-sans text-[12px] text-mute">Support</Text>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        onPress={onOpenStandards}
        className="min-h-11 justify-center active:opacity-70"
      >
        <Text className="font-sans text-[12px] text-mute">Spot standards</Text>
      </Pressable>
    </View>
  );
}
