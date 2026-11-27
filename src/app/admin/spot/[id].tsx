import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EvidencePhotos } from "@/components/evidence-photos";
import { BackIcon, HammerIcon } from "@/components/icons";
import { PhotoCarousel } from "@/components/photo-carousel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMonthYear } from "@/lib/dates";
import { BUST_FACTOR_LABELS, SURFACE_LABELS, formatSpotTypes } from "@/lib/spot-labels";
import { reportReasonLabel } from "@/lib/spot-standards";
import { colors } from "@/theme/colors";

/** Admin-only review detail with private reports and explicit moderation decisions. */
export default function AdminSpotReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const viewer = useQuery(api.moderation.viewer);
  const isAdmin = viewer?.isAdmin === true;
  const spot = useQuery(api.moderation.getSpot, isAdmin ? { id } : "skip");
  const markMeetsStandards = useMutation(api.moderation.markMeetsStandards);
  const acceptFix = useMutation(api.spotWork.accept);
  const rejectFix = useMutation(api.spotWork.reject);
  const removeApprovedFix = useMutation(api.spotWork.removeApproved);
  const banContributor = useMutation(api.moderation.banContributor);
  const unbanContributor = useMutation(api.moderation.unbanContributor);
  const [working, setWorking] = useState(false);

  const backButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => router.back()}
      className="absolute left-4 h-9 w-9 items-center justify-center rounded-full border border-white/10 active:opacity-80"
      style={{ top: insets.top + 8, backgroundColor: "rgba(30,32,36,0.82)" }}
    >
      <BackIcon size={18} color={colors.ink} />
    </Pressable>
  );

  function confirmFixDecision(approve: boolean) {
    if (!spot?.workSubmission) return;
    const workId = spot.workSubmission._id;
    const by = spot.workSubmission.submitterName;
    Alert.alert(
      approve ? "Approve this fix?" : "Reject this fix?",
      approve
        ? `The Needs work tag comes off for good, and the photos are added to the spot credited to ${by}.`
        : "The photos are deleted, and someone else can send a fix.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: approve ? "Approve" : "Reject",
          style: approve ? "default" : "destructive",
          onPress: async () => {
            setWorking(true);
            try {
              await (approve ? acceptFix : rejectFix)({ workId });
            } catch {
              // Production hides the server's reason, and another admin may have decided first.
              Alert.alert(
                "Couldn't save the decision",
                "Another admin may have reviewed this fix already, or the connection dropped.",
              );
            } finally {
              setWorking(false);
            }
          },
        },
      ],
    );
  }

  function confirmRemoveFix() {
    if (!spot?.approvedFix) return;
    const workId = spot.approvedFix._id;
    Alert.alert(
      "Remove the fix photos?",
      `The photos and ${spot.approvedFix.submitterName}'s credit are deleted. The spot stays fixed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setWorking(true);
            try {
              await removeApprovedFix({ workId });
            } catch {
              Alert.alert(
                "Couldn't remove the photos",
                "Another admin may have removed them already, or the connection dropped.",
              );
            } finally {
              setWorking(false);
            }
          },
        },
      ],
    );
  }

  function confirmApproval() {
    if (!spot) return;
    const reportText =
      spot.reports.length === 0
        ? ""
        : ` and clear ${spot.reports.length} report${spot.reports.length === 1 ? "" : "s"}`;
    Alert.alert("Mark as meeting standards?", `This will finish the review${reportText}.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          setWorking(true);
          try {
            await markMeetsStandards({ spotId: spot._id });
            router.back();
          } catch {
            Alert.alert("Couldn't finish review", "Check your connection and try again.");
            setWorking(false);
          }
        },
      },
    ]);
  }

  function confirmContributorAccess() {
    const moderationUserId = spot?.creator.moderationId;
    if (!moderationUserId) return;
    const restoring = spot.creator.isBanned;
    Alert.alert(
      restoring ? "Restore contribution access?" : "Ban this contributor?",
      restoring
        ? "They will be able to add and edit spots again. Their removal count will not change."
        : "They will still be able to sign in, browse, and delete their spots.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: restoring ? "Restore" : "Ban",
          style: restoring ? "default" : "destructive",
          onPress: async () => {
            setWorking(true);
            try {
              const args = { moderationUserId };
              if (restoring) {
                await unbanContributor(args);
              } else {
                await banContributor(args);
              }
            } catch {
              Alert.alert("Couldn't update access", "Check your connection and try again.");
            } finally {
              setWorking(false);
            }
          },
        },
      ],
    );
  }

  if (viewer === undefined || (isAdmin && spot === undefined)) {
    return (
      <View className="flex-1 items-center justify-center bg-base">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.mute} />
        {backButton}
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View className="flex-1 items-center justify-center bg-base px-8">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="font-sans-semibold text-[17px] text-ink">Administrator access only</Text>
        {backButton}
      </View>
    );
  }

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
          It may already have been removed or deleted.
        </Text>
        {backButton}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-base">
      <Stack.Screen options={{ headerShown: false }} />
      {/* Keep the first photo clear of system status-bar content, as the public screen does. */}
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 32 }}
      >
        <PhotoCarousel urls={spot.photoUrls} spotName={spot.name} />
        <View className="px-5">
          <View className="flex-row items-center gap-2">
            <View
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor:
                  spot.reports.length > 0
                    ? colors.bust.high
                    : spot.review.needsReview || spot.workSubmission
                      ? colors.bust.medium
                      : colors.bust.low,
              }}
            />
            <Text className="font-sans-semibold text-[11px] text-mute">
              {spot.reports.length > 0
                ? `${spot.reports.length} OPEN REPORT${spot.reports.length === 1 ? "" : "S"}`
                : spot.review.needsReview
                  ? spot.review.attentionReason === "edited"
                    ? "EDITED · NEEDS REVIEW"
                    : "NEW · NEEDS REVIEW"
                  : spot.workSubmission
                    ? "WORK SUBMITTED"
                    : "REVIEWED"}
            </Text>
          </View>
          <Text className="mt-2 font-sans-semibold text-[26px] tracking-tight text-ink">
            {spot.name}
          </Text>
          <Text className="mt-1 font-sans text-[13px] text-mute">
            {formatSpotTypes(spot.types)} · {BUST_FACTOR_LABELS[spot.bustFactor]} bust
            {spot.surface ? ` · ${SURFACE_LABELS[spot.surface]} surface` : ""}
          </Text>
          <Text className="mt-1 font-sans text-[12px] text-mute">
            {spot.latitude.toFixed(5)}, {spot.longitude.toFixed(5)} · Added{" "}
            {formatMonthYear(spot._creationTime)}
          </Text>
          {/* The standards remove unskateable spots, so a consented fixer-upper must be visible here. */}
          {spot.needsWork ? (
            <View className="mt-2 flex-row items-center gap-1.5">
              <HammerIcon size={12} color={colors.ink} />
              <Text className="font-sans-medium text-[12px] text-ink">
                Contributor tagged it as needing work
              </Text>
            </View>
          ) : null}
          {spot.notes ? (
            <Text className="mt-4 font-sans text-[14px] leading-relaxed text-ink/90">
              {spot.notes}
            </Text>
          ) : null}

          {spot.canAddAdminPhotos ? (
            <Card className="mt-5 p-4">
              <Text className="font-sans-medium text-[13px] text-bust-low">
                Contributor permission granted
              </Text>
              <Text className="mt-2 font-sans text-[13px] text-mute">
                You can add photos. Spot details and review decisions stay unchanged.
              </Text>
              <Button
                label="Add spot photos"
                className="mt-4"
                onPress={() =>
                  router.push({ pathname: "/admin/spot/photos/[id]", params: { id: spot._id } })
                }
              />
            </Card>
          ) : null}
          {spot.workSubmission ? (
            <>
              <Text className="mt-7 mb-2 px-1 font-sans-medium text-[11px] text-mute">
                WORK SUBMITTED
              </Text>
              <Card className="border-bust-medium/30 p-4">
                <Text className="font-sans-semibold text-[14px] text-ink">
                  Sent by {spot.workSubmission.submitterName} ·{" "}
                  {formatMonthYear(spot.workSubmission._creationTime)}
                </Text>
                {spot.workSubmission.details ? (
                  <Text className="mt-1 font-sans text-[13px] leading-relaxed text-mute">
                    {spot.workSubmission.details}
                  </Text>
                ) : null}
                <View className="mt-3">
                  <EvidencePhotos urls={spot.workSubmission.photoUrls} />
                </View>
                <Text className="mt-3 font-sans text-[12px] leading-relaxed text-mute">
                  Approving removes the Needs work tag for good and adds these photos to the spot,
                  credited to {spot.workSubmission.submitterName}. Rejecting deletes them. Neither
                  changes the spot’s own review.
                </Text>
                <Button
                  label={working ? "Working…" : "Approve fix"}
                  disabled={working}
                  onPress={() => confirmFixDecision(true)}
                  className="mt-3"
                />
                <Button
                  label="Reject"
                  variant="danger"
                  disabled={working}
                  onPress={() => confirmFixDecision(false)}
                  className="mt-2"
                />
              </Card>
            </>
          ) : null}
          {spot.approvedFix ? (
            <>
              <Text className="mt-7 mb-2 px-1 font-sans-medium text-[11px] text-mute">
                FIXED UP
              </Text>
              <Card className="p-4">
                <Text className="font-sans-semibold text-[14px] text-ink">
                  Fixed up by {spot.approvedFix.submitterName} ·{" "}
                  {formatMonthYear(spot.approvedFix.acceptedAt)}
                </Text>
                <View className="mt-3">
                  <EvidencePhotos urls={spot.approvedFix.photoUrls} />
                </View>
                <Text className="mt-3 font-sans text-[12px] leading-relaxed text-mute">
                  These photos are public on the spot. Removing them deletes the photos and the
                  credit, and the spot stays fixed. Nobody gets a strike. Meets standards closes
                  every open report, so check any others before using it to close one about these.
                </Text>
                <Button
                  label={working ? "Working…" : "Remove fix photos"}
                  variant="danger"
                  disabled={working}
                  onPress={confirmRemoveFix}
                  className="mt-3"
                />
              </Card>
            </>
          ) : null}
          <Text className="mt-7 mb-2 px-1 font-sans-medium text-[11px] text-mute">
            REPORTS ({spot.reports.length})
          </Text>
          {spot.reports.length > 0 ? (
            <View className="gap-2">
              {spot.reports.map((report) => (
                <Card key={report._id} className="border-bust-high/30 p-4">
                  <Text className="font-sans-semibold text-[14px] text-ink">
                    {reportReasonLabel(report.reason)}
                  </Text>
                  {report.details ? (
                    <Text className="mt-1 font-sans text-[13px] leading-relaxed text-mute">
                      {report.details}
                    </Text>
                  ) : null}
                  {report.photoUrls.length > 0 ? (
                    <View className="mt-3">
                      <EvidencePhotos urls={report.photoUrls} />
                    </View>
                  ) : null}
                  <Text className="mt-2 font-sans text-[11px] text-mute">
                    Reported {formatMonthYear(report._creationTime)}
                  </Text>
                </Card>
              ))}
            </View>
          ) : (
            <Card className="p-4">
              <Text className="font-sans-semibold text-[14px] text-ink">No user reports</Text>
              <Text className="mt-1 font-sans text-[12px] leading-relaxed text-mute">
                {spot.review.needsReview
                  ? "This spot is in the proactive queue because it is new or was edited."
                  : "This version already passed review."}
              </Text>
            </Card>
          )}

          <Text className="mt-7 mb-2 px-1 font-sans-medium text-[11px] text-mute">CONTRIBUTOR</Text>
          <Card className="p-4">
            <View className="flex-row items-start gap-3">
              <View className="flex-1">
                <Text className="font-sans-semibold text-[15px] text-ink">{spot.creator.name}</Text>
                <Text className="mt-1 font-sans text-[12px] text-mute">
                  {spot.creator.confirmedRemovalCount} confirmed removal
                  {spot.creator.confirmedRemovalCount === 1 ? "" : "s"}
                  {spot.creator.isBanned ? " · contribution access removed" : ""}
                </Text>
              </View>
              {spot.creator.moderationId &&
              (spot.creator.isBanned || spot.creator.confirmedRemovalCount >= 3) ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={working}
                  onPress={confirmContributorAccess}
                  className="rounded-full border border-white/15 px-3 py-2 active:opacity-80 disabled:opacity-40"
                >
                  <Text className="font-sans-semibold text-[12px] text-silver">
                    {spot.creator.isBanned ? "Restore" : "Ban"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </Card>

          <Text className="mt-7 mb-2 px-1 font-sans-medium text-[11px] text-mute">DECISION</Text>
          {/* A reviewed spot, such as one just fixed up, has nothing left to approve, but an
              admin can still remove it. Reports put a spot back in review. */}
          <Card className="p-4">
            <Text className="font-sans-semibold text-[15px] text-ink">
              {spot.review.needsReview ? "Finish this review" : "Already reviewed"}
            </Text>
            <Text className="mt-1 font-sans text-[12px] leading-relaxed text-mute">
              {spot.review.needsReview
                ? "Approving publishes the current version and clears its reports. Removal deletes the spot."
                : "This version passed review. Removal deletes the spot."}{" "}
              Dead-spot removal does not add a contributor strike.
            </Text>
            {spot.review.needsReview ? (
              <Button
                label={working ? "Working…" : "Meets standards"}
                onPress={confirmApproval}
                disabled={working}
                className="mt-4"
              />
            ) : null}
            <Button
              label="Remove spot"
              variant="danger"
              disabled={working}
              onPress={() =>
                router.push({ pathname: "/admin/spot/remove/[id]", params: { id: spot._id } })
              }
              className={spot.review.needsReview ? "mt-2" : "mt-4"}
            />
          </Card>

          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/standards")}
            className="mt-4 py-2 active:opacity-80"
          >
            <Text className="text-center font-sans-medium text-[13px] text-silver">
              Read the spot standards
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      {backButton}
    </View>
  );
}
