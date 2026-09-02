import { useAuth } from "@clerk/expo";
import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackIcon, MoreIcon, NavigateIcon, ShareIcon } from "@/components/icons";
import { FavoriteButton } from "@/components/favorite-button";
import { PhotoCarousel } from "@/components/photo-carousel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Hairline } from "@/components/ui/hairline";
import { formatMonthYear } from "@/lib/dates";
import { distanceKm, formatDistance } from "@/lib/geo";
import { openDirections } from "@/lib/open-directions";
import { spotShareUrl } from "@/lib/share-spot";
import {
  BUST_FACTOR_COLORS,
  BUST_FACTOR_LABELS,
  SURFACE_LABELS,
  formatSpotTypes,
} from "@/lib/spot-labels";
import { reportReasonLabel } from "@/lib/spot-standards";
import { useSpotAddress } from "@/lib/use-spot-address";
import { useUserLocation } from "@/lib/use-user-location";
import { colors } from "@/theme/colors";
import { TOOLBAR_HEIGHT } from "@/theme/layout";

type FactProps = { label: string; value: string; dotColor?: string; column: 0 | 1 };

/** One cell of the 2×2 hairline facts grid. */
function Fact({ label, value, dotColor, column }: FactProps) {
  return (
    <View
      className={`w-1/2 border-t border-white/10 py-3 ${column === 1 ? "border-l pl-4" : "pr-4"}`}
    >
      <Text className="font-sans text-[11px] text-mute">{label}</Text>
      <View className="mt-0.5 flex-row items-center gap-1.5">
        {dotColor ? (
          <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
        ) : null}
        <Text
          className="font-sans-medium text-[14px] text-ink"
          style={dotColor ? { color: dotColor } : undefined}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const spot = useQuery(api.spots.get, { id });
  const removeSpot = useMutation(api.spots.remove);
  const toggleFavorite = useMutation(api.favorites.toggle);
  const [favoritePending, setFavoritePending] = useState(false);
  const { coords, granted } = useUserLocation();
  const activeSpot = spot?.status === "active" ? spot : null;
  const detailHeaderHeight = insets.top + TOOLBAR_HEIGHT;
  // Android's geocoder needs location permission; iOS's does not.
  const address = useSpotAddress(
    activeSpot?.latitude,
    activeSpot?.longitude,
    Platform.OS === "ios" || granted,
  );

  const backButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => router.back()}
      className="absolute left-4 h-9 w-9 items-center justify-center rounded-full border border-white/10 active:opacity-80"
      style={{ top: insets.top + 8, backgroundColor: "rgba(30,32,36,0.72)" }}
    >
      <BackIcon size={18} color={colors.ink} />
    </Pressable>
  );

  if (spot === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.mute} />
        {backButton}
      </View>
    );
  }

  if (spot === null) {
    return (
      <View className="flex-1 items-center justify-center bg-base px-8">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="font-sans-semibold text-[17px] text-ink">This spot is gone</Text>
        <Text className="mt-2 text-center font-sans text-[14px] text-mute">
          It may have been removed by the person who added it.
        </Text>
        {backButton}
      </View>
    );
  }

  if (spot.status === "removed") {
    return (
      <View className="flex-1 bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 72,
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 24,
          }}
        >
          <Card className="p-5">
            <Text className="font-sans-medium text-[11px] text-mute">SPOT REMOVED</Text>
            <Text className="mt-2 font-sans-semibold text-[22px] tracking-tight text-ink">
              {spot.name}
            </Text>
            <Text className="mt-3 font-sans text-[15px] leading-relaxed text-mute">
              This spot was removed because it did not meet YYC Skate Spots standards. Other users
              can no longer see it; this notice is visible only to you.
            </Text>
          </Card>
          <Card className="mt-3 p-5">
            <Text className="font-sans-medium text-[11px] text-mute">REMOVAL REASON</Text>
            <Text className="mt-2 font-sans-semibold text-[16px] text-ink">
              {reportReasonLabel(spot.reason)}
            </Text>
            <Text className="mt-2 font-sans text-[13px] leading-relaxed text-mute">
              This was confirmed removal {spot.strikeNumber}. At three, an administrator may block
              an account from adding or editing spots.
            </Text>
          </Card>
          <Button
            label="Read the spot standards"
            onPress={() => router.push("/standards")}
            className="mt-4"
          />
        </ScrollView>
        {backButton}
      </View>
    );
  }

  // Captured here because TS narrowing of `spot` doesn't reach the closures below.
  const spotId = spot._id;
  const spotName = spot.name;
  const destination = { name: spotName, latitude: spot.latitude, longitude: spot.longitude };

  async function handleDirections() {
    try {
      await openDirections(destination);
    } catch {
      // openURL rejects when nothing handles the URL or the user cancels.
      Alert.alert("Couldn't open a maps app", "Install Google Maps or Apple Maps and try again.");
    }
  }

  async function handleShare() {
    try {
      const url = spotShareUrl(spotId);
      const message = `Check out ${spotName} on YYC Skate Spots.`;
      await Share.share(
        Platform.OS === "ios"
          ? { message, url }
          : { message: `${message}\n${url}`, title: spotName },
      );
    } catch {
      Alert.alert("Couldn't share this spot", "Check your connection and try again.");
    }
  }

  async function handleToggleFavorite() {
    if (!isSignedIn) {
      Alert.alert("Sign in to save spots", "Keep a favourites list across all your devices.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign in", onPress: () => router.push("/account") },
      ]);
      return;
    }

    setFavoritePending(true);
    try {
      await toggleFavorite({ spotId });
    } catch {
      Alert.alert("Couldn't update favourites", "Check your connection and try again.");
    } finally {
      setFavoritePending(false);
    }
  }

  function confirmDelete() {
    Alert.alert("Delete this spot?", "Its photos are removed too. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await removeSpot({ id: spotId });
            router.back();
          } catch {
            Alert.alert("Couldn't delete", "Check your connection and try again.");
          }
        },
      },
    ]);
  }

  const added = `Added ${formatMonthYear(spot._creationTime)}`;
  const byline = spot.isOwner
    ? `${added} by you`
    : spot.createdByName
      ? `${added} by ${spot.createdByName}`
      : added;

  return (
    <View className="flex-1 bg-base">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: detailHeaderHeight,
          paddingBottom: insets.bottom + 104,
        }}
      >
        <PhotoCarousel urls={spot.photoUrls} spotName={spot.name} variant="gallery" />

        <View className="px-5">
          <Text className="font-sans-semibold text-[26px] tracking-tight text-ink">
            {spot.name}
          </Text>
          {address ? <Text className="mt-1 font-sans text-[14px] text-mute">{address}</Text> : null}

          {spot.isPendingReview ? (
            <Card className="mt-4 border-bust-medium/30 p-4">
              <Text className="font-sans-semibold text-[15px] text-ink">Waiting for review</Text>
              <Text className="mt-1 font-sans text-[13px] leading-relaxed text-mute">
                This version is visible only to you and administrators until it meets the spot
                standards.
              </Text>
            </Card>
          ) : null}

          <View className="mt-4 flex-row flex-wrap">
            <Fact label="Type" value={formatSpotTypes(spot.types)} column={0} />
            <Fact
              label="Distance"
              value={coords ? formatDistance(distanceKm(coords, spot)) : "—"}
              column={1}
            />
            <Fact
              label="Bust factor"
              value={BUST_FACTOR_LABELS[spot.bustFactor]}
              dotColor={BUST_FACTOR_COLORS[spot.bustFactor]}
              column={0}
            />
            <Fact
              label="Surface"
              value={spot.surface ? SURFACE_LABELS[spot.surface] : "—"}
              column={1}
            />
          </View>
          <Hairline />

          {spot.notes ? (
            <Text className="mt-4 font-sans text-[15px] leading-relaxed text-ink/90">
              {spot.notes}
            </Text>
          ) : null}
          <Text className="mt-4 font-sans text-[12px] text-mute">{byline}</Text>

          {!spot.isOwner ? (
            <Card className="mt-6 p-4">
              <Text className="font-sans-semibold text-[15px] text-ink">Spot not right?</Text>
              <Text className="mt-1 font-sans text-[13px] leading-relaxed text-mute">
                Send a private report if this listing does not meet the spot standards.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  isSignedIn
                    ? router.push({ pathname: "/spot/report/[id]", params: { id: spotId } })
                    : router.push("/account")
                }
                className="mt-3 self-start py-1 active:opacity-80"
              >
                <Text className="font-sans-semibold text-[13px] text-silver">
                  {isSignedIn ? "Report this spot" : "Sign in to report"}
                </Text>
              </Pressable>
            </Card>
          ) : null}
        </View>
      </ScrollView>

      {/* The opaque toolbar keeps the initial photo clear of system status-bar content. */}
      <View
        pointerEvents="none"
        className="absolute inset-x-0 top-0 items-center justify-end bg-base pb-5"
        style={{ height: detailHeaderHeight }}
      >
        <Text className="font-sans-semibold text-[12px] uppercase tracking-widest text-mute">
          Spot details
        </Text>
      </View>
      {backButton}
      <View className="absolute right-4 flex-row gap-2" style={{ top: insets.top + 8 }}>
        {spot.isPendingReview ? null : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share spot"
              onPress={() => void handleShare()}
              className="h-9 w-9 items-center justify-center rounded-full border border-white/10 active:opacity-80"
              style={{ backgroundColor: "rgba(30,32,36,0.72)" }}
            >
              <ShareIcon size={18} color={colors.ink} />
            </Pressable>
            <FavoriteButton
              isFavorite={spot.isFavorite}
              busy={favoritePending}
              disabled={!authLoaded}
              onPress={() => void handleToggleFavorite()}
            />
          </>
        )}
        {/* Only the owner gets the menu; the server rejects anyone else anyway. */}
        {spot.isOwner ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Spot options"
            onPress={() =>
              Alert.alert(spot.name, undefined, [
                {
                  text: "Edit spot",
                  onPress: () =>
                    router.push({ pathname: "/spot/edit/[id]", params: { id: spotId } }),
                },
                { text: "Delete spot", style: "destructive", onPress: confirmDelete },
                { text: "Cancel", style: "cancel" },
              ])
            }
            className="h-9 w-9 items-center justify-center rounded-full border border-white/10 active:opacity-80"
            style={{ backgroundColor: "rgba(30,32,36,0.72)" }}
          >
            <MoreIcon size={18} color={colors.ink} />
          </Pressable>
        ) : null}
      </View>

      <View
        className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-base px-5 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <Button
          label="Take Me There"
          icon={<NavigateIcon size={17} color={colors.ink} />}
          onPress={() => void handleDirections()}
        />
      </View>
    </View>
  );
}
