import { Image, type ImageLoadEventData } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  clamp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackIcon, CloseIcon } from "@/components/icons";
import { colors } from "@/theme/colors";

const MAX_ZOOM = 4;
const ZOOM_STEP = 0.75;
const HEADER_HEIGHT = 56;
const FOOTER_HEIGHT = 72;

type PhotoViewerProps = {
  urls: string[];
  spotName: string;
  index: number;
  visible: boolean;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

type ImageSize = { url: string; width: number; height: number };

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
  const [sourceSize, setSourceSize] = useState<ImageSize | null>(null);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
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
    window.height - insets.top - insets.bottom - HEADER_HEIGHT - FOOTER_HEIGHT,
  );
  const currentUrl = urls[index];
  const currentSourceSize = sourceSize?.url === currentUrl ? sourceSize : null;
  const containScale = currentSourceSize
    ? Math.min(viewportWidth / currentSourceSize.width, viewportHeight / currentSourceSize.height)
    : 1;
  const imageWidth = currentSourceSize ? currentSourceSize.width * containScale : viewportWidth;
  const imageHeight = currentSourceSize ? currentSourceSize.height * containScale : viewportHeight;
  const canGoBack = index > 0;
  const canGoForward = index < urls.length - 1;

  function resetZoom() {
    scale.value = withTiming(1);
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
  }

  function adjustZoom(amount: number) {
    const nextScale = clamp(scale.value + amount, 1, MAX_ZOOM);
    const maxX = Math.max(0, (imageWidth * nextScale - viewportWidth) / 2);
    const maxY = Math.max(0, (imageHeight * nextScale - viewportHeight) / 2);

    scale.value = withTiming(nextScale);
    translateX.value = withTiming(clamp(translateX.value, -maxX, maxX));
    translateY.value = withTiming(clamp(translateY.value, -maxY, maxY));
  }

  function changePhoto(direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex >= 0 && nextIndex < urls.length) {
      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      onIndexChange(nextIndex);
    }
  }

  function handleLoad(event: ImageLoadEventData) {
    setSourceSize({
      url: currentUrl,
      width: event.source.width,
      height: event.source.height,
    });
  }

  const pan = Gesture.Pan()
    .maxPointers(1)
    .minDistance(6)
    .onStart(() => {
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value <= 1.01) return;

      const maxX = Math.max(0, (imageWidth * scale.value - viewportWidth) / 2);
      const maxY = Math.max(0, (imageHeight * scale.value - viewportHeight) / 2);
      translateX.value = clamp(panStartX.value + event.translationX, -maxX, maxX);
      translateY.value = clamp(panStartY.value + event.translationY, -maxY, maxY);
    })
    .onEnd((event) => {
      if (
        scale.value <= 1.01 &&
        Math.abs(event.translationX) > 64 &&
        Math.abs(event.translationX) > Math.abs(event.translationY) * 1.2
      ) {
        const direction = event.translationX > 0 ? -1 : 1;
        runOnJS(changePhoto)(direction);
      }
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

      // Hold the focal point under the fingers while keeping the photo inside its viewport.
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
      if (scale.value <= 1.01) {
        scale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .onEnd((event, success) => {
      if (!success) return;

      if (scale.value > 1.01) {
        scale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        return;
      }

      const nextScale = 2.5;
      const maxX = Math.max(0, (imageWidth * nextScale - viewportWidth) / 2);
      const maxY = Math.max(0, (imageHeight * nextScale - viewportHeight) / 2);
      scale.value = withTiming(nextScale);
      translateX.value = withTiming(
        clamp((viewportWidth / 2 - event.x) * (nextScale - 1), -maxX, maxX),
      );
      translateY.value = withTiming(
        clamp((viewportHeight / 2 - event.y) * (nextScale - 1), -maxY, maxY),
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
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={onClose}
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
            style={{ height: insets.top + HEADER_HEIGHT }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close photo viewer"
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:opacity-80"
            >
              <CloseIcon size={19} color={colors.ink} />
            </Pressable>
            <Text className="pb-2 font-sans-medium text-[13px] text-ink">
              {index + 1} of {urls.length}
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
              <View
                collapsable={false}
                className="items-center justify-center overflow-hidden"
                style={{ width: viewportWidth, height: viewportHeight }}
              >
                <Animated.View
                  style={[{ width: imageWidth, height: imageHeight }, animatedImageStyle]}
                >
                  <Image
                    source={{ uri: currentUrl }}
                    contentFit="contain"
                    onLoad={handleLoad}
                    accessibilityLabel={`${spotName}, photo ${index + 1} of ${urls.length}`}
                    style={{ width: imageWidth, height: imageHeight }}
                  />
                </Animated.View>
              </View>
            </GestureDetector>

            {canGoBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous photo"
                onPress={() => changePhoto(-1)}
                className="absolute left-3 top-1/2 h-10 w-10 -translate-y-5 items-center justify-center rounded-full bg-black/60 active:opacity-80"
              >
                <BackIcon size={20} color={colors.ink} />
              </Pressable>
            ) : null}
            {canGoForward ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next photo"
                onPress={() => changePhoto(1)}
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
