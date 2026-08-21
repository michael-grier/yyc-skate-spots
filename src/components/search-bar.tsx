import { Pressable, TextInput, View } from "react-native";

import { BoardMark } from "@/components/board-mark";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { colors } from "@/theme/colors";

type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  onFocus?: () => void;
  onSubmitEditing?: () => void;
};

/** Matte search pill with the board mark as the app's only on-map branding. */
export function SearchBar({ value, onChangeText, onFocus, onSubmitEditing }: SearchBarProps) {
  return (
    <View
      className="h-12 flex-row items-center gap-2.5 rounded-2xl border border-white/10 px-3.5"
      style={{ backgroundColor: "rgba(30,32,36,0.92)" }}
    >
      <BoardMark size={20} strokeWidth={2.2} />
      <View className="h-4 w-px bg-white/15" />
      <SearchIcon size={16} color={colors.mute} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search spots"
        placeholderTextColor={colors.mute}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onFocus={onFocus}
        onSubmitEditing={onSubmitEditing}
        clearButtonMode="never"
        accessibilityLabel="Search spots by name"
        className="flex-1 font-sans text-[15px] text-ink"
        // Vertical centering on Android needs the padding zeroed explicitly.
        style={{ paddingVertical: 0 }}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
          onPress={() => onChangeText("")}
        >
          <CloseIcon size={16} color={colors.mute} />
        </Pressable>
      ) : null}
    </View>
  );
}
