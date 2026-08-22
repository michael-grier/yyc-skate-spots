import { Pressable, Text } from "react-native";

import { Card } from "@/components/ui/card";
import { formatDistance } from "@/lib/geo";
import { type BustFactor, type SpotType, formatSpotTypes } from "@/lib/spot-labels";

type Suggestion = {
  _id: string;
  name: string;
  types: SpotType[];
  bustFactor: BustFactor;
  distanceKm?: number;
};

type SearchSuggestionsProps = {
  suggestions: Suggestion[];
  onPick: (id: string) => void;
};

/** Matching spots listed under the search bar while the user is typing. */
export function SearchSuggestions({ suggestions, onPick }: SearchSuggestionsProps) {
  if (suggestions.length === 0) {
    return (
      <Card className="px-4 py-3" style={{ backgroundColor: "rgba(30,32,36,0.96)" }}>
        <Text className="font-sans text-[13px] text-mute">No spots match that.</Text>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden" style={{ backgroundColor: "rgba(30,32,36,0.96)" }}>
      {suggestions.map((spot, i) => (
        <Pressable
          key={spot._id}
          accessibilityRole="button"
          onPress={() => onPick(spot._id)}
          className={`px-4 py-3 active:bg-white/5 ${i > 0 ? "border-t border-white/10" : ""}`}
        >
          <Text numberOfLines={1} className="font-sans-semibold text-[14px] text-ink">
            {spot.name}
          </Text>
          <Text numberOfLines={1} className="mt-0.5 font-sans text-[12px] text-mute">
            {[
              formatSpotTypes(spot.types),
              spot.distanceKm !== undefined && formatDistance(spot.distanceKm),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </Pressable>
      ))}
    </Card>
  );
}
