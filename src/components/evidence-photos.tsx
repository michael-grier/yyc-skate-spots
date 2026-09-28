import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { PhotoViewer } from "@/components/photo-viewer";
import { colors } from "@/theme/colors";

/**
 * Private report evidence, shown whole: a crop could hide what an admin needs to judge the report.
 * Each photo opens the full-screen viewer for zooming.
 */
export function EvidencePhotos({ urls }: { urls: string[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <View className="flex-row gap-2">
      {urls.map((url, i) => (
        <Pressable
          key={url}
          accessibilityRole="button"
          accessibilityLabel={`Open evidence photo ${i + 1} of ${urls.length}`}
          onPress={() => setOpenIndex(i)}
          className="flex-1 active:opacity-80"
        >
          <Image
            source={{ uri: url }}
            contentFit="contain"
            transition={200}
            style={{
              width: "100%",
              aspectRatio: 3 / 4,
              borderRadius: 12,
              backgroundColor: colors.base,
            }}
          />
        </Pressable>
      ))}
      <PhotoViewer
        urls={urls}
        spotName="Private report evidence"
        index={openIndex ?? 0}
        visible={openIndex !== null}
        onIndexChange={setOpenIndex}
        onClose={() => setOpenIndex(null)}
      />
    </View>
  );
}
