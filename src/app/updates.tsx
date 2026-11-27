import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { useMutation, usePaginatedQuery } from "convex/react";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackIcon, BellIcon, ChevronRightIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { formatNoticeTime } from "@/lib/dates";
import { reportReasonLabel } from "@/lib/spot-standards";
import { colors } from "@/theme/colors";

type Notice = FunctionReturnType<typeof api.notices.list>["page"][number];

const PAGE_SIZE = 20;
// notices.markRead's per-call limit.
const MARK_READ_BATCH = 100;

// The card shows the spot name on its own line, so the copy never repeats it.
function noticeCopy({ kind }: Notice): { headline: string; body?: string } {
  switch (kind) {
    case "spot_published":
      return {
        headline: "Your spot is live",
        body: "It’s on the map for everyone now. Thanks for adding it.",
      };
    case "spot_removed":
      return { headline: "Your spot was removed" };
    case "spot_changes_requested":
      return { headline: "Changes requested" };
    case "report_kept":
      return {
        headline: "We reviewed your report",
        body: "It meets our standards, so it’s staying on the map. Thanks for flagging it.",
      };
    case "report_removed":
      return {
        headline: "Spot removed after your report",
        body: "Thanks for the report. We reviewed the spot and took it off the map.",
      };
  }
}

function NoticeCard({
  notice,
  unread,
  now,
  onOpen,
}: {
  notice: Notice;
  unread: boolean;
  now: number;
  onOpen: (spotId: Id<"spots">) => void;
}) {
  const { headline, body } = noticeCopy(notice);
  const isRemoval = notice.kind === "spot_removed";
  const spotId = notice.spotId;

  const content = (
    <Card className="mb-2 flex-row items-center gap-3 p-4">
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          {unread ? (
            <View
              accessible
              accessibilityLabel="New"
              className="h-[7px] w-[7px] rounded-full bg-bust-low"
            />
          ) : null}
          <Text className="flex-1 font-sans-semibold text-[15px] text-ink">{headline}</Text>
          <Text className="font-sans text-[12px] text-mute">
            {formatNoticeTime(notice._creationTime, now)}
          </Text>
        </View>
        <Text className="mt-0.5 font-sans text-[12px] text-mute">{notice.spotName}</Text>
        {isRemoval && notice.reason ? (
          <Text className="mt-1.5 font-sans-medium text-[12px] text-bust-high">
            Reason: {reportReasonLabel(notice.reason)}
          </Text>
        ) : null}
        {notice.message ? (
          <View className="mt-2 border-l-2 border-white/20 pl-3">
            <Text className="font-sans-medium text-[10px] text-mute">FROM YYC SKATE SPOTS</Text>
            <Text className="mt-0.5 font-sans text-[13px] leading-relaxed text-ink">
              {notice.message}
            </Text>
          </View>
        ) : null}
        {body ? (
          <Text className="mt-1.5 font-sans text-[13px] leading-relaxed text-ink">{body}</Text>
        ) : null}
        {!isRemoval && notice.reason ? (
          <Text className="mt-1.5 font-sans text-[12px] text-mute">
            Your report: {reportReasonLabel(notice.reason)}
          </Text>
        ) : null}
      </View>
      {spotId ? <ChevronRightIcon size={18} color={colors.mute} /> : null}
    </Card>
  );

  // A reporter's removed spot is gone, so that update has nothing to open.
  return spotId ? (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpen(spotId)}
      className="active:opacity-90"
    >
      {content}
    </Pressable>
  ) : (
    content
  );
}

/** The signed-in user's updates from YYC Skate Spots. Leaving it marks what loaded as read. */
export default function UpdatesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { results, status, loadMore } = usePaginatedQuery(
    api.notices.list,
    {},
    { initialNumItems: PAGE_SIZE },
  );
  const markRead = useMutation(api.notices.markRead);
  // Ages are relative to when the screen opened.
  const [now] = useState(() => Date.now());

  // Each card shows its whole update, so seeing the list counts as reading it. Marking
  // on leaving keeps the dots up while the list is on screen.
  const loadedUnread = useRef<Id<"notices">[]>([]);
  useEffect(() => {
    loadedUnread.current = results
      .filter((notice) => notice.readAt === undefined)
      .map((notice) => notice._id);
  }, [results]);
  useFocusEffect(
    useCallback(
      () => () => {
        const ids = loadedUnread.current;
        for (let start = 0; start < ids.length; start += MARK_READ_BATCH) {
          // A failed mark only leaves the badge up until the next visit.
          markRead({ ids: ids.slice(start, start + MARK_READ_BATCH) }).catch(() => undefined);
        }
      },
      [markRead],
    ),
  );

  return (
    <View className="flex-1 bg-base">
      <Stack.Screen options={{ headerShown: false }} />
      <View
        className="flex-row items-center gap-3 border-b border-white/10 px-5 pb-4"
        style={{ paddingTop: insets.top + 12 }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-full border border-white/10 active:opacity-80"
        >
          <BackIcon size={18} color={colors.ink} />
        </Pressable>
        <Text className="font-sans-semibold text-[20px] tracking-tight text-ink">Updates</Text>
      </View>

      {status === "LoadingFirstPage" ? (
        <ActivityIndicator color={colors.mute} className="mt-12" />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(notice) => notice._id}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: insets.bottom + 24,
          }}
          renderItem={({ item }) => (
            <NoticeCard
              notice={item}
              unread={item.readAt === undefined}
              now={now}
              onOpen={(id) => router.push({ pathname: "/spot/[id]", params: { id } })}
            />
          )}
          onEndReached={() => {
            if (status === "CanLoadMore") loadMore(PAGE_SIZE);
          }}
          ListFooterComponent={
            status === "LoadingMore" ? (
              <ActivityIndicator color={colors.mute} className="mt-2" />
            ) : null
          }
          ListEmptyComponent={
            <View className="items-center px-8 pt-24">
              <BellIcon size={28} color={colors.mute} />
              <Text className="mt-3 font-sans-semibold text-[17px] text-ink">No updates yet</Text>
              <Text className="mt-1.5 text-center font-sans text-[14px] leading-relaxed text-mute">
                When we review a spot you added or reported, you’ll hear about it here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
