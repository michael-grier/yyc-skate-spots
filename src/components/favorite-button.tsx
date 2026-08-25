import { ActivityIndicator, Pressable } from "react-native";

import { HeartIcon } from "@/components/icons";
import { colors } from "@/theme/colors";

type FavoriteButtonProps = {
  isFavorite: boolean;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

/** Heart toggle shown over a spot's photo carousel. */
export function FavoriteButton({
  isFavorite,
  busy = false,
  disabled = false,
  onPress,
}: FavoriteButtonProps) {
  const label = isFavorite ? "Remove from favourites" : "Add to favourites";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFavorite, disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      className="h-9 w-9 items-center justify-center rounded-full border border-white/10 active:opacity-80 disabled:opacity-50"
      style={{ backgroundColor: "rgba(30,32,36,0.72)" }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.ink} />
      ) : (
        <HeartIcon size={18} color={colors.ink} filled={isFavorite} />
      )}
    </Pressable>
  );
}
