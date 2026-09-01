import { Image } from "expo-image";
import { useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { BoardMark } from "@/components/board-mark";
import { ExpandIcon } from "@/components/icons";
import { PhotoViewer } from "@/components/photo-viewer";
import { colors } from "@/theme/colors";

export const CAROUSEL_HEIGHT = 320;

type PhotoCarouselProps = {
  urls: string[];
  /** Used for the images' accessibility labels. */
  spotName: string;
  /** The public detail page uses a taller carousel with full-screen inspection. */
  variant?: "compact" | "gallery";
};

/** Full-bleed paged photos that fade into the screen background. */
export function PhotoCarousel({ urls, spotName, variant = "compact" }: PhotoCarouselProps) {
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  // Keep the gallery dominant without hiding all spot context on shorter phones.
  const carouselHeight =
    variant === "gallery"
      ? Math.round(Math.min(height * 0.56, Math.max(width * 1.15, CAROUSEL_HEIGHT + 64)))
      : CAROUSEL_HEIGHT;

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(
      Math.round(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width),
    );
  }

  return (
    <View style={{ height: carouselHeight }}>
      {urls.length === 0 ? (
        <View className="flex-1 items-center justify-center bg-card">
          <BoardMark size={64} color={colors.mute} />
        </View>
      ) : (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumEnd}
        >
          {urls.map((url, i) => (
            <Pressable
              key={`${url}-${i}`}
              accessibilityRole={variant === "gallery" ? "button" : undefined}
              accessibilityLabel={
                variant === "gallery"
                  ? `Open ${spotName}, photo ${i + 1} of ${urls.length}`
                  : undefined
              }
              disabled={variant !== "gallery"}
              onPress={() => setViewerIndex(i)}
              style={{ width, height: carouselHeight }}
            >
              <Image
                source={{ uri: url }}
                contentFit="cover"
                transition={200}
                accessible={variant !== "gallery"}
                accessibilityLabel={`${spotName}, photo ${i + 1} of ${urls.length}`}
                style={{ width, height: carouselHeight }}
              />
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Fade the bottom edge into the matte background so the title sits on it. */}
      <Svg
        pointerEvents="none"
        width="100%"
        height={96}
        style={{ position: "absolute", bottom: 0 }}
      >
        <Defs>
          <LinearGradient id="photo-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.base} stopOpacity="0" />
            <Stop offset="1" stopColor={colors.base} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#photo-fade)" />
      </Svg>

      {urls.length > 1 ? (
        <View className="absolute inset-x-0 bottom-6 flex-row justify-center gap-1.5">
          {urls.map((url, i) => (
            <View
              key={`${url}-${i}`}
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: i === index ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)",
              }}
            />
          ))}
        </View>
      ) : null}

      {variant === "gallery" && urls.length > 0 ? (
        <View
          pointerEvents="none"
          className="absolute bottom-4 right-4 flex-row items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 py-2"
        >
          <ExpandIcon size={14} color={colors.ink} />
          <Text className="font-sans-semibold text-[11px] text-ink">View</Text>
        </View>
      ) : null}

      {variant === "gallery" && viewerIndex !== null ? (
        <PhotoViewer
          urls={urls}
          spotName={spotName}
          index={viewerIndex}
          visible
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </View>
  );
}
