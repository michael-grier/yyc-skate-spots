import { Image } from "expo-image";
import { useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { BoardMark } from "@/components/board-mark";
import { colors } from "@/theme/colors";

export const CAROUSEL_HEIGHT = 320;

type PhotoCarouselProps = {
  urls: string[];
  /** Used for the images' accessibility labels. */
  spotName: string;
};

/** Full-bleed paged photos that fade into the screen background. */
export function PhotoCarousel({ urls, spotName }: PhotoCarouselProps) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  return (
    <View style={{ height: CAROUSEL_HEIGHT }}>
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
            <Image
              key={url}
              source={{ uri: url }}
              contentFit="cover"
              transition={200}
              accessibilityLabel={`${spotName}, photo ${i + 1} of ${urls.length}`}
              style={{ width, height: CAROUSEL_HEIGHT }}
            />
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
              key={url}
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: i === index ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)",
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
