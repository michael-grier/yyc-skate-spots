import { useAuth } from "@clerk/expo";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PhotoStrip } from "@/components/spot-fields";
import { StandardsAcceptanceSheet } from "@/components/standards-acceptance-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { resolveConvexSiteUrl } from "@/lib/convex-site";
import { type FormPhoto, MAX_PHOTOS } from "@/lib/spot-form";
import { pickPhotos, uploadPhoto } from "@/lib/spot-photos";
import { colors } from "@/theme/colors";

const UPLOAD_HOST = resolveConvexSiteUrl(
  process.env.EXPO_PUBLIC_CONVEX_URL ?? "",
  process.env.EXPO_PUBLIC_CONVEX_SITE_URL,
);

/** A photo-only admin form; the mutation rechecks consent after the uploads finish. */
export default function AdminSpotPhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const viewer = useQuery(api.moderation.viewer);
  const spot = useQuery(api.moderation.getSpot, viewer?.isAdmin ? { id } : "skip");
  const addAdminPhotos = useMutation(api.spots.addAdminPhotos);
  const discardUpload = useMutation(api.spots.discardUpload);
  const acknowledgeStandards = useMutation(api.moderation.acknowledgeStandards);
  const [photos, setPhotos] = useState<FormPhoto[]>([]);
  const [working, setWorking] = useState(false);
  const [picking, setPicking] = useState(false);
  const [standardsOpen, setStandardsOpen] = useState(false);
  const busy = useRef(false);

  async function addPhotos() {
    if (busy.current || picking || photos.length >= MAX_PHOTOS) return;
    setPicking(true);
    try {
      const picked = await pickPhotos(MAX_PHOTOS - photos.length);
      setPhotos((current) => {
        const keys = new Set(current.map((photo) => photo.key));
        return [
          ...current,
          ...picked.filter((photo) => {
            if (keys.has(photo.key)) return false;
            keys.add(photo.key);
            return true;
          }),
        ].slice(0, MAX_PHOTOS);
      });
    } catch {
      Alert.alert("Couldn't open photos", "Try again.");
    } finally {
      setPicking(false);
    }
  }

  async function publish(acceptStandards = false) {
    if (busy.current || picking || !spot || !spot.canAddAdminPhotos || photos.length === 0) return;
    if (!viewer?.hasAcknowledgedStandards && !acceptStandards) {
      setStandardsOpen(true);
      return;
    }
    busy.current = true;
    setWorking(true);
    const uploaded: Id<"_storage">[] = [];
    try {
      if (acceptStandards) await acknowledgeStandards({});
      setStandardsOpen(false);
      for (const photo of photos) {
        const token = await getToken({ template: "convex" });
        if (!token) throw new Error("Sign in again to upload photos.");
        uploaded.push(await uploadPhoto(photo, UPLOAD_HOST, token));
      }
      await addAdminPhotos({ id: spot._id, photoIds: uploaded });
      router.back();
    } catch (error) {
      await Promise.allSettled(uploaded.map((storageId) => discardUpload({ storageId })));
      Alert.alert("Couldn't add photos", error instanceof Error ? error.message : "Try again.");
    } finally {
      busy.current = false;
      setWorking(false);
    }
  }

  const loading = viewer === undefined || (viewer.isAdmin && spot === undefined);
  return (
    <View className="flex-1 bg-base">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
        }}
      >
        <Button
          label="Back"
          disabled={working}
          onPress={() => router.back()}
          className="mb-5 self-start px-5"
        />
        <Text className="font-sans-semibold text-[24px] tracking-tight text-ink">
          Add spot photos
        </Text>
        {loading ? (
          <ActivityIndicator color={colors.mute} className="mt-8" />
        ) : !viewer?.isAdmin ? (
          <Text className="mt-4 font-sans text-[15px] text-mute">Administrator access only</Text>
        ) : viewer.isBanned || !spot?.canAddAdminPhotos ? (
          <Text className="mt-4 font-sans text-[15px] text-mute">
            Photo upload is unavailable. The spot may already have photos, or permission may have
            been withdrawn.
          </Text>
        ) : (
          <>
            <Card className="mt-5 p-4">
              <Text className="font-sans-semibold text-[17px] text-ink">{spot.name}</Text>
              <Text className="mt-1 font-sans text-[13px] text-mute">{spot.creator.name}</Text>
              <Text className="mt-3 font-sans-medium text-[12px] text-bust-low">
                Contributor permission granted
              </Text>
            </Card>
            <Text className="my-5 font-sans text-[14px] leading-relaxed text-mute">
              Add photos you took of this spot. Only photos will change; the contributor keeps
              control of the listing.
            </Text>
            <Text className="mb-2 font-sans text-[12px] text-mute">
              PHOTOS · {photos.length} of {MAX_PHOTOS}
            </Text>
            <PhotoStrip
              photos={photos}
              maxPhotos={MAX_PHOTOS}
              disabled={working || picking}
              onAdd={() => void addPhotos()}
              onRemove={(photo) =>
                setPhotos((current) => current.filter((p) => p.key !== photo.key))
              }
            />
            <Text className="mt-5 font-sans text-[13px] leading-relaxed text-mute">
              The contributor will see an update in Your spots. Any pending spot review stays open.
            </Text>
            <Button
              label={working ? "Uploading…" : "Publish photos"}
              variant="light"
              disabled={working || picking || photos.length === 0}
              onPress={() => void publish()}
              className="mt-5"
            />
          </>
        )}
      </ScrollView>
      <StandardsAcceptanceSheet
        visible={standardsOpen}
        submitting={working}
        onClose={() => setStandardsOpen(false)}
        onAgree={() => void publish(true)}
        onReadFullStandards={() => {
          setStandardsOpen(false);
          router.push("/standards");
        }}
      />
    </View>
  );
}
