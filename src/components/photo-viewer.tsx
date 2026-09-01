import { Image, type ImageLoadEventData } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  clamp,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackIcon, CloseIcon } from "@/components/icons";
import { type Size, containedSize } from "@/lib/photo-fit";
import { colors } from "@/theme/colors";
import { TOOLBAR_HEIGHT } from "@/theme/layout";

const MAX_ZOOM = 4;
const ZOOM_STEP = 0.75;
const DOUBLE_TAP_ZOOM = 2.5;
const FOOTER_HEIGHT = 72;
/** Past this the photo counts as zoomed: paging locks so panning can take over. */
const ZOOMED_ABOVE = 1.01;

type PhotoViewerProps = {
  urls: string[];
  spotName: string;
  index: number;
  visible: boolean;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

/** Full-screen photo inspection with paging, pinch zoom, and constrained panning. */
export function PhotoViewer({
  urls,
  spotName,
  index,
  visible,
  onIndexChange,
  onClose,
}: PhotoViewerProps) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);
  // Keyed by URL so paging back to a photo reuses the size it already reported.
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  const [zoomed, setZoomed] = useState(false);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  // Where `scale` is heading, so rapid button taps step off a settled value rather
  // than off whatever the previous animation happens to be passing through.
  const zoomTarget = useSharedValue(1);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const pinchStartX = useSharedValue(0);
  const pinchStartY = useSharedValue(0);
  const pinchStartFocalX = useSharedValue(0);
  const pinchStartFocalY = useSharedValue(0);

  const viewportWidth = window.width;
  const viewportHeight = Math.max(
    1,
    window.height - insets.top - insets.bottom - TOOLBAR_HEIGHT - FOOTER_HEIGHT,
  );
  const viewport = { width: viewportWidth, height: viewportHeight };
  // `urls` is reactive: another device can delete a photo while the viewer is open, so
  // never index past the end of the list the parent last handed us.
  const safeIndex = urls.length > 0 ? Math.min(index, urls.length - 1) : 0;
  const activeImage = containedSize(sizes[urls[safeIndex]], viewport);
  const imageWidth = activeImage.width;
  const imageHeight = activeImage.height;
  const canGoBack = safeIndex > 0;
  const canGoForward = safeIndex < urls.length - 1;

  // Page offsets are absolute, so without this a rotation, a deleted photo, or an arrow
  // tap leaves the pager parked on the wrong page.
  useEffect(() => {
    pagerRef.current?.scrollTo({ x: safeIndex * viewportWidth, animated: false });
  }, [safeIndex, viewportWidth]);

  // One place to derive the flag that gates paging, whatever moved the scale.
  useAnimatedReaction(
    () => scale.value > ZOOMED_ABOVE,
    (isZoomed, wasZoomed) => {
      if (isZoomed !== wasZoomed) runOnJS(setZoomed)(isZoomed);
    },
  );

  function measure(url: string, event: ImageLoadEventData) {
    const size = { width: event.source.width, height: event.source.height };
    setSizes((current) => (current[url] ? current : { ...current, [url]: size }));
  }

  function resetZoom() {
    zoomTarget.value = 1;
    scale.value = withTiming(1);
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
  }

  function adjustZoom(amount: number) {
    const nextScale = clamp(zoomTarget.value + amount, 1, MAX_ZOOM);
    const maxX = Math.max(0, (imageWidth * nextScale - viewportWidth) / 2);
    const maxY = Math.max(0, (imageHeight * nextScale - viewportHeight) / 2);

    zoomTarget.value = nextScale;
    scale.value = withTiming(nextScale);
    translateX.value = withTiming(clamp(translateX.value, -maxX, maxX));
    translateY.value = withTiming(clamp(translateY.value, -maxY, maxY));
  }

  /** Drops zoom and pan with no animation, for moments with nothing to animate from. */
  function snapZoomReset() {
    zoomTarget.value = 1;
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
  }

  function goToPage(next: number) {
    if (next < 0 || next >= urls.length || next === safeIndex) return;
    // A page always arrives unzoomed.
    snapZoomReset();
    onIndexChange(next);
  }

  function handleClose() {
    snapZoomReset();
    onClose();
  }

  function handlePageEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const pageWidth = event.nativeEvent.layoutMeasurement.width;
    if (pageWidth <= 0) return;
    goToPage(Math.round(event.nativeEvent.contentOffset.x / pageWidth));
  }

  // React Compiler (app.config.ts) memoizes these for us; a manual useMemo here is
  // both redundant and rejected by react-hooks/immutability, which forbids mutating
  // shared values inside a memo callback.
  const pan = Gesture.Pan()
    .maxPointers(1)
    .minDistance(6)
    // Below this the pager owns horizontal touches, so swiping pages as it should.
    .enabled(zoomed)
    .onStart(() => {
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      const maxX = Math.max(0, (imageWidth * scale.value - viewportWidth) / 2);
      const maxY = Math.max(0, (imageHeight * scale.value - viewportHeight) / 2);
      translateX.value = clamp(panStartX.value + event.translationX, -maxX, maxX);
      translateY.value = clamp(panStartY.value + event.translationY, -maxY, maxY);
    });

  const pinch = Gesture.Pinch()
    .onStart((event) => {
      pinchStartScale.value = scale.value;
      pinchStartX.value = translateX.value;
      pinchStartY.value = translateY.value;
      pinchStartFocalX.value = event.focalX - viewportWidth / 2;
      pinchStartFocalY.value = event.focalY - viewportHeight / 2;
    })
    .onUpdate((event) => {
      const nextScale = clamp(pinchStartScale.value * event.scale, 1, MAX_ZOOM);
      const ratio = nextScale / pinchStartScale.value;
      const focalX = event.focalX - viewportWidth / 2;
      const focalY = event.focalY - viewportHeight / 2;
      const maxX = Math.max(0, (imageWidth * nextScale - viewportWidth) / 2);
      const maxY = Math.max(0, (imageHeight * nextScale - viewportHeight) / 2);

      // Hold the focal point under the fingers while keeping the photo in its viewport.
      zoomTarget.value = nextScale;
      scale.value = nextScale;
      translateX.value = clamp(
        focalX - ratio * (pinchStartFocalX.value - pinchStartX.value),
        -maxX,
        maxX,
      );
      translateY.value = clamp(
        focalY - ratio * (pinchStartFocalY.value - pinchStartY.value),
        -maxY,
        maxY,
      );
    })
    .onEnd(() => {
      if (scale.value > ZOOMED_ABOVE) return;
      zoomTarget.value = 1;
      scale.value = withTiming(1);
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event, success) => {
      if (!success) return;

      if (scale.value > ZOOMED_ABOVE) {
        zoomTarget.value = 1;
        scale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        return;
      }

      const maxX = Math.max(0, (imageWidth * DOUBLE_TAP_ZOOM - viewportWidth) / 2);
      const maxY = Math.max(0, (imageHeight * DOUBLE_TAP_ZOOM - viewportHeight) / 2);
      zoomTarget.value = DOUBLE_TAP_ZOOM;
      scale.value = withTiming(DOUBLE_TAP_ZOOM);
      translateX.value = withTiming(
        clamp((viewportWidth / 2 - event.x) * (DOUBLE_TAP_ZOOM - 1), -maxX, maxX),
      );
      translateY.value = withTiming(
        clamp((viewportHeight / 2 - event.y) * (DOUBLE_TAP_ZOOM - 1), -maxY, maxY),
      );
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pan, pinch));

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Modal
      animationType="fade"
      // Without this the container defaults to white and flashes behind the fade.
      backdropColor="#000"
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={handleClose}
      onShow={snapZoomReset}
      presentationStyle="fullScreen"
      statusBarTranslucent
      visible={visible}
    >
      <StatusBar style="light" />
      {/* Android modals need their own native gesture root for pinch and pan events. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-black">
          <View
            className="flex-row items-end justify-between px-4 pb-2"
            style={{ height: insets.top + TOOLBAR_HEIGHT }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close photo viewer"
              onPress={handleClose}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:opacity-80"
            >
              <CloseIcon size={19} color={colors.ink} />
            </Pressable>
            <Text className="pb-2 font-sans-medium text-[13px] text-ink">
              {safeIndex + 1} of {urls.length}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset photo zoom"
              onPress={resetZoom}
              className="h-10 justify-center rounded-full bg-white/10 px-3 active:opacity-80"
            >
              <Text className="font-sans-semibold text-[12px] text-ink">Reset</Text>
            </Pressable>
          </View>

          <View style={{ width: viewportWidth, height: viewportHeight }}>
            <GestureDetector gesture={gesture}>
              <ScrollView
                ref={pagerRef}
                horizontal
                pagingEnabled
                // A zoomed photo pans instead of paging; the pan gesture takes over.
                scrollEnabled={!zoomed}
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handlePageEnd}
              >
                {urls.map((url, i) => {
                  const image = containedSize(sizes[url], viewport);
                  return (
                    <View
                      key={`${url}-${i}`}
                      collapsable={false}
                      className="items-center justify-center overflow-hidden"
                      style={{ width: viewportWidth, height: viewportHeight }}
                    >
                      <Animated.View
                        style={[
                          { width: image.width, height: image.height },
                          animatedImageStyle,
                        ]}
                      >
                        <Image
                          source={{ uri: url }}
                          contentFit="contain"
                          onLoad={(event) => measure(url, event)}
                          accessibilityLabel={`${spotName}, photo ${i + 1} of ${urls.length}`}
                          style={{ width: image.width, height: image.height }}
                        />
                      </Animated.View>
                    </View>
                  );
                })}
              </ScrollView>
            </GestureDetector>

            {canGoBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous photo"
                onPress={() => goToPage(safeIndex - 1)}
                className="absolute left-3 top-1/2 h-10 w-10 -translate-y-5 items-center justify-center rounded-full bg-black/60 active:opacity-80"
              >
                <BackIcon size={20} color={colors.ink} />
              </Pressable>
            ) : null}
            {canGoForward ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next photo"
                onPress={() => goToPage(safeIndex + 1)}
                className="absolute right-3 top-1/2 h-10 w-10 -translate-y-5 rotate-180 items-center justify-center rounded-full bg-black/60 active:opacity-80"
              >
                <BackIcon size={20} color={colors.ink} />
              </Pressable>
            ) : null}
          </View>

          <View
            className="items-center justify-start gap-2 pt-1"
            style={{ height: insets.bottom + FOOTER_HEIGHT, paddingBottom: insets.bottom }}
          >
            <Text className="font-sans text-[11px] text-white/60">Pinch or double-tap to zoom</Text>
            <View className="flex-row gap-3">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zoom out"
                onPress={() => adjustZoom(-ZOOM_STEP)}
                className="h-9 w-9 items-center justify-center rounded-full bg-white/10 active:opacity-80"
              >
                <Text className="font-sans-medium text-[22px] leading-none text-ink">−</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zoom in"
                onPress={() => adjustZoom(ZOOM_STEP)}
                className="h-9 w-9 items-center justify-center rounded-full bg-white/10 active:opacity-80"
              >
                <Text className="font-sans-medium text-[20px] leading-none text-ink">+</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
