import { fireEvent, render, screen } from "@testing-library/react-native";
import { type ImageProps, StyleSheet } from "react-native";

import { SpotPreviewCard } from "./spot-preview-card";

jest.mock("expo-image", () => {
  const { Image } = jest.requireActual<typeof import("react-native")>("react-native");
  // Pass native styles through without teaching the mock to interpret className.
  return {
    Image: ({ source, style }: ImageProps) => (
      <Image testID="preview-photo" source={source} style={style} />
    ),
  };
});

const SPOT = {
  name: "Harmony Park",
  types: ["ledge", "stairs"] as ("ledge" | "stairs")[],
  bustFactor: "medium" as const,
  previewPhotoUrl: null,
};

describe("SpotPreviewCard", () => {
  test("gives the photo native dimensions so it is visible in the map card", async () => {
    const photoUrl = "https://example.com/spot.jpg";
    await render(<SpotPreviewCard {...SPOT} previewPhotoUrl={photoUrl} />);

    // Inspect the Expo Image boundary because the mock cannot reproduce native layout.
    const photo = screen.getByTestId("preview-photo");
    expect(photo.props.source).toEqual({ uri: photoUrl });
    expect(StyleSheet.flatten(photo.props.style)).toMatchObject({ width: 72, height: 72 });
  });

  test("is a plain card without a destination: no button, no chevron", async () => {
    await render(<SpotPreviewCard {...SPOT} />);
    expect(screen.getByText("Harmony Park")).toBeOnTheScreen();
    expect(screen.getByText(/Ledge · Stairs/)).toBeOnTheScreen();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("becomes pressable with a destination and includes the distance", async () => {
    const onPress = jest.fn();
    await render(<SpotPreviewCard {...SPOT} distanceKm={1.23} onPress={onPress} />);
    expect(screen.getByText(/1\.2 km away/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test("labels the user's own spot", async () => {
    await render(<SpotPreviewCard {...SPOT} mine />);
    expect(screen.getByText(/Your spot/)).toBeOnTheScreen();
  });
});
