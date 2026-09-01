import { Image } from "expo-image";
import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { CloseIcon } from "@/components/icons";
import { Chip } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { type FormPhoto, MAX_PHOTOS } from "@/lib/spot-form";
import { toggle } from "@/lib/toggle";
import {
  BUST_FACTOR_COLORS,
  BUST_FACTOR_LABELS,
  BUST_FACTORS,
  type BustFactor,
  SPOT_TYPE_LABELS,
  SPOT_TYPES,
  type SpotType,
  SURFACE_LABELS,
  SURFACES,
  type Surface,
} from "@/lib/spot-labels";
import { colors } from "@/theme/colors";

// NativeWind uses a 14-point rem on native, so h-20 would render smaller than an 80-point photo.
const PHOTO_TILE_DIMENSIONS = { width: 80, height: 80 };

const TYPES_PER_ROW = 3;

// A fixed 3-per-row grid reads as one block; a wrapping row of pills reads as a
// ragged wall, which is the complaint this layout answers.
const TYPE_ROWS = Array.from({ length: Math.ceil(SPOT_TYPES.length / TYPES_PER_ROW) }, (_, row) =>
  SPOT_TYPES.slice(row * TYPES_PER_ROW, row * TYPES_PER_ROW + TYPES_PER_ROW),
);

const BUST_FACTOR_OPTIONS = BUST_FACTORS.map((bust) => ({
  value: bust,
  label: BUST_FACTOR_LABELS[bust],
  dotColor: BUST_FACTOR_COLORS[bust],
}));

const SURFACE_OPTIONS = SURFACES.map((surface) => ({
  value: surface,
  label: SURFACE_LABELS[surface],
}));

export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  /** Replaces the standalone-section spacing when the field is a row inside a card. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <View className={className ?? "mt-5"}>
      <View className="mb-2 flex-row items-baseline gap-1.5 px-1">
        <Text className="font-sans-medium text-[11px] text-mute">{label}</Text>
        {hint ? <Text className="font-sans text-[11px] text-mute/60">{hint}</Text> : null}
      </View>
      {children}
      {error ? (
        <Text
          accessibilityRole="alert"
          className="mt-1.5 px-1 font-sans text-[12px] text-bust-high"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function NameInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="What do locals call it?"
      placeholderTextColor={colors.mute}
      accessibilityLabel="Spot name"
      className="font-sans text-[15px] text-ink"
      style={{ paddingVertical: 0 }}
    />
  );
}

/** Every type at once, in an even grid. Used where there is room: the add wizard. */
export function TypeGrid({
  value,
  onChange,
}: {
  value: SpotType[];
  onChange: (value: SpotType[]) => void;
}) {
  return (
    <View className="gap-2">
      {TYPE_ROWS.map((row) => (
        <View key={row[0]} className="flex-row gap-2">
          {row.map((type) => (
            <Chip
              key={type}
              label={SPOT_TYPE_LABELS[type]}
              selected={value.includes(type)}
              onPress={() => onChange(toggle(value, type))}
              className="min-h-12 flex-1"
            />
          ))}
          {/* Keeps a short final row from stretching its chips across the grid. */}
          {row.length < TYPES_PER_ROW ? (
            <View style={{ flex: TYPES_PER_ROW - row.length }} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** One row that scrolls sideways instead of wrapping. Used where height is scarce: editing. */
export function TypeCarousel({
  value,
  onChange,
}: {
  value: SpotType[];
  onChange: (value: SpotType[]) => void;
}) {
  // Types already chosen lead the row so editing never hides one off screen. The
  // order is fixed at mount so chips do not jump around as they are tapped.
  const [order] = useState(() =>
    [...SPOT_TYPES].sort((a, b) => Number(value.includes(b)) - Number(value.includes(a))),
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 16 }}
    >
      {order.map((type) => (
        <Chip
          key={type}
          label={SPOT_TYPE_LABELS[type]}
          selected={value.includes(type)}
          onPress={() => onChange(toggle(value, type))}
        />
      ))}
    </ScrollView>
  );
}

export function BustFactorField({
  value,
  onChange,
}: {
  value: BustFactor | null;
  onChange: (value: BustFactor) => void;
}) {
  return <Segmented options={BUST_FACTOR_OPTIONS} value={value} onChange={onChange} />;
}

export function SurfaceField({
  value,
  onChange,
}: {
  value: Surface | null;
  onChange: (value: Surface | null) => void;
}) {
  return (
    <Segmented
      options={SURFACE_OPTIONS}
      value={value}
      // Ground is one or the other, so there is no third option to offer. The
      // field is optional though, so tapping the chosen surface clears it.
      onChange={(surface) => onChange(surface === value ? null : surface)}
    />
  );
}

export function PhotoStrip({
  photos,
  onAdd,
  onRemove,
}: {
  photos: FormPhoto[];
  onAdd: () => void;
  onRemove: (photo: FormPhoto) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2.5">
      {photos.map((photo, index) => (
        <View key={photo.key} style={PHOTO_TILE_DIMENSIONS}>
          <Image
            source={{ uri: photo.uri }}
            contentFit="cover"
            accessible
            accessibilityLabel={`Selected photo ${index + 1}`}
            style={{ ...PHOTO_TILE_DIMENSIONS, borderRadius: 12 }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove photo"
            hitSlop={6}
            onPress={() => onRemove(photo)}
            className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full border border-white/20"
            style={{ backgroundColor: "rgba(30,32,36,0.95)" }}
          >
            <CloseIcon size={12} color={colors.ink} />
          </Pressable>
        </View>
      ))}
      {photos.length < MAX_PHOTOS ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add photos"
          onPress={onAdd}
          className="items-center justify-center rounded-xl border border-dashed border-white/20 active:opacity-80"
          style={PHOTO_TILE_DIMENSIONS}
        >
          <Text className="font-sans text-[24px] text-mute">+</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
