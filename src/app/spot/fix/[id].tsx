import { useAuth } from "@clerk/expo";
import { MAX_FIX_PHOTOS } from "@convex/constants";
import type { Id } from "@convex/_generated/dataModel";
import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackIcon } from "@/components/icons";
import { SignInView } from "@/components/sign-in-view";
import { PhotoStrip } from "@/components/spot-fields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { resolveConvexSiteUrl } from "@/lib/convex-site";
import type { FormPhoto } from "@/lib/spot-form";
import { pickPhotos, uploadPhoto } from "@/lib/spot-photos";
import { useContributionGate } from "@/lib/use-contribution-gate";
import { useRevealFieldOnKeyboard } from "@/lib/use-reveal-field-on-keyboard";
import { colors } from "@/theme/colors";

const MAX_DETAILS_LENGTH = 500;
const UPLOAD_HOST = resolveConvexSiteUrl(
  process.env.EXPO_PUBLIC_CONVEX_URL ?? "",
  process.env.EXPO_PUBLIC_CONVEX_SITE_URL,
);

/** Photos of a finished fix, sent for admin review. Laid out like the report form. */
export default function FixSpotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const spot = useQuery(api.spots.get, { id });
  const submitFix = useMutation(api.spotWork.submit);
  const discardUpload = useMutation(api.spots.discardUpload);
  const { runGated, standardsSheet, ready: gateReady } = useContributionGate();
  const [photos, setPhotos] = useState<FormPhoto[]>([]);
  const [picking, setPicking] = useState(false);
  const busy = useRef(false);
  const [details, setDetails] = useState("");
  const { scrollRef, onFieldLayout } = useRevealFieldOnKeyboard();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addPhotos() {
    if (picking || submitting || photos.length >= MAX_FIX_PHOTOS) return;
    setPicking(true);
    try {
      const picked = await pickPhotos(MAX_FIX_PHOTOS - photos.length);
      setPhotos((current) => {
        const keys = new Set(current.map((photo) => photo.key));
        const added = picked.filter((photo) => {
          if (keys.has(photo.key)) return false;
          keys.add(photo.key);
          return true;
        });
        return [...current, ...added].slice(0, MAX_FIX_PHOTOS);
      });
    } catch {
      setError("Couldn't open your photos. Try again.");
    } finally {
      setPicking(false);
    }
  }

  async function send() {
    if (busy.current || spot?.status !== "active" || photos.length === 0) return;
    busy.current = true;
    const uploaded: Id<"_storage">[] = [];
    setSubmitting(true);
    setError(null);
    try {
      // Upload only on send, so an abandoned form leaves no files behind.
      for (const photo of photos) {
        const token = await getToken({ template: "convex" });
        if (!token) throw new Error("Sign in again to upload photos.");
        uploaded.push(await uploadPhoto(photo, UPLOAD_HOST, token));
      }
      await submitFix({
        spotId: spot._id,
        photoIds: uploaded,
        ...(details.trim() ? { details: details.trim() } : {}),
      });
      setSubmitted(true);
    } catch (sendError) {
      await Promise.allSettled(uploaded.map((storageId) => discardUpload({ storageId })));
      setError(sendError instanceof Error ? sendError.message : "The photos could not be sent.");
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  const header = (
    <View
      className="flex-row items-center gap-3 border-b border-white/10 px-5 pb-4"
      style={{ paddingTop: insets.top + 12 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={8}
        onPress={() => {
          if (!busy.current) router.back();
        }}
        disabled={submitting}
        className="h-9 w-9 items-center justify-center rounded-full border border-white/10 active:opacity-80"
      >
        <BackIcon size={18} color={colors.ink} />
      </Pressable>
      <Text className="font-sans-semibold text-[20px] tracking-tight text-ink">I fixed it</Text>
    </View>
  );

  if (!isLoaded || spot === undefined) {
    return (
      <View className="flex-1 bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <ActivityIndicator color={colors.mute} className="mt-12" />
      </View>
    );
  }

  if (!isSignedIn) {
    // Keep the spot in this route while Clerk completes any sign-in method.
    return (
      <View className="flex-1 bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <SignInView hasHeader />
      </View>
    );
  }

  if (submitted) {
    return (
      <View className="flex-1 bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <View className="flex-1 justify-center px-5">
          <Card className="p-5">
            <Text className="font-sans-medium text-[11px] text-mute">SENT FOR REVIEW</Text>
            <Text className="mt-2 font-sans-semibold text-[22px] tracking-tight text-ink">
              Thanks for fixing it up
            </Text>
            <Text className="mt-3 font-sans text-[14px] leading-relaxed text-mute">
              An admin will check your photos. Once they’re approved, the Needs work tag comes off
              and your photos join the spot with your name on them.
            </Text>
          </Card>
          <Button label="Back to spot" onPress={() => router.back()} className="mt-4" />
        </View>
      </View>
    );
  }

  // A fix already waiting, or a tag removed meanwhile, leaves nothing to send.
  if (spot === null || spot.status !== "active" || !spot.needsWork || spot.pendingFix !== null) {
    return (
      <View className="flex-1 bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <View className="flex-1 items-center justify-center px-8">
          <Text className="font-sans-semibold text-[17px] text-ink">Nothing to fix here</Text>
          <Text className="mt-2 text-center font-sans text-[14px] text-mute">
            The spot no longer needs work, or someone has already sent photos of a fix.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-base">
      <Stack.Screen options={{ headerShown: false }} />
      {header}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: insets.bottom + 32,
          }}
        >
          <Text className="font-sans-semibold text-[18px] text-ink">{spot.name}</Text>
          <Text className="mt-1 font-sans text-[14px] leading-relaxed text-mute">
            Show the finished fix. An admin checks your photos, then the Needs work tag comes off
            and your photos are added to the spot with your name on them.
          </Text>

          <View className="mt-5">
            <Text className="mb-2 font-sans-medium text-[13px] text-silver">Photos · Required</Text>
            {photos.length === 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add photos"
                onPress={() => void addPhotos()}
                disabled={picking || submitting}
                className="items-center rounded-2xl border border-dashed border-white/20 bg-card px-4 py-7 active:opacity-80"
              >
                <Text className="font-sans text-[28px] text-mute">+</Text>
                <Text className="mt-2 font-sans-semibold text-[15px] text-silver">Add photos</Text>
                <Text className="mt-1 font-sans text-[12px] text-mute">
                  Show what the spot looks like now.
                </Text>
              </Pressable>
            ) : (
              <PhotoStrip
                photos={photos}
                maxPhotos={MAX_FIX_PHOTOS}
                disabled={submitting || picking}
                onAdd={() => void addPhotos()}
                onRemove={(photo) =>
                  setPhotos((current) => current.filter((p) => p.key !== photo.key))
                }
              />
            )}
            <Text className="mt-2 font-sans text-[12px] leading-relaxed text-mute">
              Add 1–{MAX_FIX_PHOTOS} photos of the finished fix.
            </Text>
          </View>

          <View onLayout={onFieldLayout}>
            <Text className="mt-5 mb-2 px-1 font-sans-medium text-[11px] text-mute">
              WHAT YOU DID (OPTIONAL)
            </Text>
            <Card className="px-4 py-3">
              <TextInput
                value={details}
                editable={!submitting}
                onChangeText={setDetails}
                maxLength={MAX_DETAILS_LENGTH}
                placeholder="Patched the crack, moved the rock…"
                placeholderTextColor={colors.mute}
                multiline
                textAlignVertical="top"
                accessibilityLabel="What you did"
                className="min-h-[96px] max-h-[160px] font-sans text-[14px] leading-relaxed text-ink"
                style={{ paddingVertical: 0 }}
              />
            </Card>
            <Text className="mt-1.5 px-1 text-right font-sans text-[11px] text-mute">
              {details.length}/{MAX_DETAILS_LENGTH}
            </Text>
          </View>

          {error ? (
            <Text className="mt-3 font-sans text-[13px] text-bust-high">{error}</Text>
          ) : null}
          <Button
            label={submitting ? "Sending…" : "Send for review"}
            // Uploading needs the current standards, so the gate runs before any photo leaves.
            onPress={() => runGated(send)}
            disabled={submitting || picking || photos.length === 0 || !gateReady}
            className="mt-4"
          />
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/standards")}
            className="mt-4 py-2 active:opacity-80"
          >
            <Text className="text-center font-sans-medium text-[13px] text-silver">
              Read the spot standards
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      {standardsSheet}
    </View>
  );
}
