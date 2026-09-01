import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
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
// Exported so the carousel test can assert which photo the dots point at.
export const ACTIVE_DOT_COLOR = "rgba(255,255,255,0.9)";
export const INACTIVE_DOT_COLOR = "rgba(255,255,255,0.35)";

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
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  // Tracked by URL rather than position: if the open photo is deleted elsewhere the
  // viewer closes instead of silently showing its neighbour, and a gallery that empties
  // and refills cannot reopen a viewer the user never asked for.
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const viewerIndex = viewerUrl === null ? -1 : urls.indexOf(viewerUrl);
  // Keep the gallery dominant without hiding all spot context on shorter phones. The
  // empty-state placeholder keeps the compact height so a photo-less spot stays small.
  const carouselHeight =
    variant === "gallery" && urls.length > 0
      ? Math.round(Math.min(height * 0.56, Math.max(width * 1.15, CAROUSEL_HEIGHT + 64)))
      : CAROUSEL_HEIGHT;

  // `urls` is reactive, so a photo deleted on another device can leave the stored index
  // past the end, which would otherwise leave no dot active.
  const activeIndex = urls.length > 0 ? Math.min(index, urls.length - 1) : 0;

  // Page offsets are absolute, so without this a rotation leaves the list parked between
  // two photos, and paging inside the viewer never moves the carousel underneath it.
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: activeIndex * width, animated: false });
  }, [activeIndex, width]);

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const pageWidth = event.nativeEvent.layoutMeasurement.width;
    if (pageWidth <= 0) return;
    setIndex(Math.round(event.nativeEvent.contentOffset.x / pageWidth));
  }

  function handleViewerIndexChange(next: number) {
    setViewerUrl(urls[next] ?? null);
    setIndex(next);
  }

  return (
    <View style={{ height: carouselHeight }}>
      {urls.length === 0 ? (
        <View className="flex-1 items-center justify-center bg-card">
          <BoardMark size={64} color={colors.mute} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
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
              onPress={() => setViewerUrl(url)}
              style={{ width, height: carouselHeight }}
            >
              {/* In the gallery the wrapping button carries the label, so the image
                  stays out of the accessibility tree rather than repeating it. */}
              <Image
                source={{ uri: url }}
                contentFit="cover"
                transition={200}
                accessible={variant !== "gallery"}
                accessibilityLabel={
                  variant === "gallery"
                    ? undefined
                    : `${spotName}, photo ${i + 1} of ${urls.length}`
                }
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
              testID={`photo-dot-${i}`}
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: i === activeIndex ? ACTIVE_DOT_COLOR : INACTIVE_DOT_COLOR }}
            />
          ))}
        </View>
      ) : null}

      {variant === "gallery" && urls.length > 0 ? (
        <View
          pointerEvents="none"
          // Decorative: the photo button already announces that it opens. pointerEvents
          // alone would leave this in the accessibility tree as a stray "View".
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="absolute bottom-4 right-4 flex-row items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 py-2"
        >
          <ExpandIcon size={14} color={colors.ink} />
          <Text className="font-sans-semibold text-[11px] text-ink">View</Text>
        </View>
      ) : null}

      {/* Kept mounted so the Modal's fade plays on the way out too. It renders nothing
          while closed, so the full-size photos are not loaded until it opens. */}
      {variant === "gallery" ? (
        <PhotoViewer
          urls={urls}
          spotName={spotName}
          index={viewerIndex < 0 ? 0 : viewerIndex}
          visible={viewerIndex >= 0}
          onIndexChange={handleViewerIndexChange}
          onClose={() => setViewerUrl(null)}
        />
      ) : null}
    </View>
  );
}
