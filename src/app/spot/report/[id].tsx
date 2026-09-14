import { useAuth } from "@clerk/expo";
import { MAX_REPORT_PHOTOS } from "@convex/constants";
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

import { PhotoStrip } from "@/components/spot-fields";
import type { FormPhoto } from "@/lib/spot-form";
import { pickPhotos, uploadPhoto } from "@/lib/spot-photos";
import { resolveConvexSiteUrl } from "@/lib/convex-site";
import { BackIcon } from "@/components/icons";
import { ModerationReasonPicker } from "@/components/moderation-reason-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ReportReason } from "@/lib/spot-standards";
import { colors } from "@/theme/colors";

const MAX_DETAILS_LENGTH = 500;
const UPLOAD_HOST = resolveConvexSiteUrl(
  process.env.EXPO_PUBLIC_CONVEX_URL ?? "",
  process.env.EXPO_PUBLIC_CONVEX_SITE_URL,
);

/** Signed-in report form; the mutation independently checks identity and ownership. */
export default function ReportSpotScreen() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const spot = useQuery(api.spots.get, { id });
  const createReport = useMutation(api.reports.create);
  const [reason, setReason] = useState<ReportReason | null>(
    kind === "dead" ? "gone_or_unusable" : null,
  );
  const isDeadReport = reason === "gone_or_unusable";
  const [photos, setPhotos] = useState<FormPhoto[]>([]);
  const [picking, setPicking] = useState(false);
  const busy = useRef(false);
  const discardUpload = useMutation(api.reportPhotos.discardUpload);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addPhotos() {
    if (picking || submitting || photos.length >= MAX_REPORT_PHOTOS) return;
    setPicking(true);
    try {
      const picked = await pickPhotos(MAX_REPORT_PHOTOS - photos.length);
      setPhotos((current) => {
        const keys = new Set(current.map((photo) => photo.key));
        const added = picked.filter((photo) => {
          if (keys.has(photo.key)) return false;
          keys.add(photo.key);
          return true;
        });
        return [...current, ...added].slice(0, MAX_REPORT_PHOTOS);
      });
    } catch {
      setError("Couldn't open your photos. Try again.");
    } finally {
      setPicking(false);
    }
  }

  async function submit() {
    if (busy.current || picking) return;
    if (!reason || spot?.status !== "active") {
      setError("Choose the reason that best describes the problem.");
      return;
    }
    if (isDeadReport && photos.length === 0) {
      setError("Add at least one photo showing why the spot is no longer skateable.");
      return;
    }
    busy.current = true;
    const uploaded: Id<"_storage">[] = [];
    setSubmitting(true);
    setError(null);
    try {
      // Upload only on submit. Failed or abandoned uploads have server-side expiry too.
      if (isDeadReport) {
        for (const photo of photos) {
          const token = await getToken({ template: "convex" });
          if (!token) throw new Error("Sign in again to upload photos.");
          uploaded.push(await uploadPhoto(photo, UPLOAD_HOST, token, "report"));
        }
      }
      await createReport({
        spotId: spot._id,
        reason,
        ...(uploaded.length ? { photoIds: uploaded } : {}),
        ...(details.trim() ? { details: details.trim() } : {}),
      });
      setSubmitted(true);
    } catch (submitError) {
      await Promise.allSettled(uploaded.map((storageId) => discardUpload({ storageId })));
      setError(
        submitError instanceof Error ? submitError.message : "The report could not be sent.",
      );
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
      <Text className="font-sans-semibold text-[20px] tracking-tight text-ink">
        {kind === "dead" ? "Report dead spot" : "Report spot"}
      </Text>
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
    return (
      <View className="flex-1 bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <View className="flex-1 justify-center px-8">
          <Text className="text-center font-sans-semibold text-[18px] text-ink">
            Sign in to report a spot
          </Text>
          <Text className="mt-2 text-center font-sans text-[14px] leading-relaxed text-mute">
            Reports stay private and are reviewed by the administrator.
          </Text>
          <Button label="Sign in" onPress={() => router.push("/account")} className="mt-6" />
        </View>
      </View>
    );
  }

  if (spot === null || spot.status !== "active" || spot.isOwner) {
    return (
      <View className="flex-1 bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <View className="flex-1 items-center justify-center px-8">
          <Text className="font-sans-semibold text-[17px] text-ink">Nothing to report here</Text>
          <Text className="mt-2 text-center font-sans text-[14px] text-mute">
            The spot is unavailable, or it belongs to you.
          </Text>
        </View>
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
            <Text className="font-sans-medium text-[11px] text-mute">REPORT RECEIVED</Text>
            <Text className="mt-2 font-sans-semibold text-[22px] tracking-tight text-ink">
              Thanks for looking out
            </Text>
            <Text className="mt-3 font-sans text-[14px] leading-relaxed text-mute">
              Your report is private. The spot has been returned to the review queue for an admin
              decision.
            </Text>
          </Card>
          <Button label="Back to spot" onPress={() => router.back()} className="mt-4" />
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
            {kind === "dead"
              ? "Skate-stopped, demolished, or permanently blocked? Help keep the map up to date."
              : "Choose the closest reason. Reports are not shown to the contributor."}
          </Text>

          {kind !== "dead" ? (
            <View className="mt-5" pointerEvents={submitting ? "none" : "auto"}>
              <ModerationReasonPicker
                value={reason}
                onChange={(selectedReason) => {
                  if (busy.current) return;
                  setReason(selectedReason);
                  setError(null);
                }}
              />
            </View>
          ) : null}

          {isDeadReport ? (
            <View className="mt-5">
              <Text className="mb-2 font-sans-medium text-[13px] text-silver">
                Photos · Required
              </Text>
              {photos.length === 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add photos"
                  onPress={() => void addPhotos()}
                  disabled={picking || submitting}
                  className="items-center rounded-2xl border border-dashed border-white/20 bg-card px-4 py-7 active:opacity-80"
                >
                  <Text className="font-sans text-[28px] text-mute">+</Text>
                  <Text className="mt-2 font-sans-semibold text-[15px] text-silver">
                    Add photos
                  </Text>
                  <Text className="mt-1 font-sans text-[12px] text-mute">
                    Show what makes this spot unskateable.
                  </Text>
                </Pressable>
              ) : (
                <PhotoStrip
                  photos={photos}
                  maxPhotos={MAX_REPORT_PHOTOS}
                  disabled={submitting || picking}
                  onAdd={() => void addPhotos()}
                  onRemove={(photo) =>
                    setPhotos((current) => current.filter((p) => p.key !== photo.key))
                  }
                />
              )}
              <Text className="mt-2 font-sans text-[12px] leading-relaxed text-mute">
                Add 1–3 recent photos. Only administrators can see your evidence.
              </Text>
            </View>
          ) : null}

          <Text className="mt-5 mb-2 px-1 font-sans-medium text-[11px] text-mute">
            DETAILS (OPTIONAL)
          </Text>
          <Card className="px-4 py-3">
            <TextInput
              value={details}
              editable={!submitting}
              onChangeText={setDetails}
              maxLength={MAX_DETAILS_LENGTH}
              placeholder="What should the admin know?"
              placeholderTextColor={colors.mute}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Report details"
              className="min-h-[96px] font-sans text-[14px] leading-relaxed text-ink"
              style={{ paddingVertical: 0 }}
            />
          </Card>
          <Text className="mt-1.5 px-1 text-right font-sans text-[11px] text-mute">
            {details.length}/{MAX_DETAILS_LENGTH}
          </Text>

          {error ? (
            <Text className="mt-3 font-sans text-[13px] text-bust-high">{error}</Text>
          ) : null}
          {isDeadReport ? (
            <Text className="mt-4 font-sans text-[12px] leading-relaxed text-mute">
              An admin will review your evidence before deciding whether to remove the spot.
            </Text>
          ) : null}
          <Button
            label={submitting ? "Sending…" : "Send report"}
            onPress={() => void submit()}
            disabled={submitting || picking || (isDeadReport && photos.length === 0)}
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
    </View>
  );
}
