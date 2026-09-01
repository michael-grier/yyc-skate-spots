import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { LocationPicker } from "./location-picker";

const mockAnimateToRegion = jest.fn();
const mockLocate = jest.fn();
let mockCoords: { latitude: number; longitude: number } | null = null;

jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("react-native-maps", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Pressable, Text } = jest.requireActual<typeof import("react-native")>("react-native");

  type MockMapProps = {
    accessibilityLabel?: string;
    mapType?: string;
    onRegionChangeComplete?: (region: {
      latitude: number;
      longitude: number;
      latitudeDelta: number;
      longitudeDelta: number;
    }) => void;
  };

  const MockMap = React.forwardRef(function MockMap(
    { accessibilityLabel, mapType, onRegionChangeComplete }: MockMapProps,
    ref: React.ForwardedRef<{ animateToRegion: typeof mockAnimateToRegion }>,
  ) {
    React.useImperativeHandle(ref, () => ({ animateToRegion: mockAnimateToRegion }));
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() =>
          onRegionChangeComplete?.({
            latitude: 51.05,
            longitude: -114.08,
            latitudeDelta: 0.004,
            longitudeDelta: 0.004,
          })
        }
      >
        <Text>Map type: {mapType}</Text>
      </Pressable>
    );
  });

  return { __esModule: true, default: MockMap, PROVIDER_GOOGLE: "google" };
});

jest.mock("@/lib/use-user-location", () => ({
  useUserLocation: () => ({ coords: mockCoords, granted: !!mockCoords, locate: mockLocate }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCoords = null;
  mockLocate.mockResolvedValue(null);
});

describe("LocationPicker", () => {
  test("does not adopt an available GPS position without a tap", async () => {
    mockCoords = { latitude: 51.05, longitude: -114.08 };
    const onChange = jest.fn();

    await render(<LocationPicker value={null} onChange={onChange} />);

    expect(screen.getByText("No location set")).toBeOnTheScreen();
    expect(onChange).not.toHaveBeenCalled();
  });

  test("uses the current location after explicit confirmation", async () => {
    const position = { latitude: 51.05, longitude: -114.08 };
    mockLocate.mockResolvedValue(position);
    const onChange = jest.fn();

    await render(<LocationPicker value={null} onChange={onChange} />);
    await fireEvent.press(screen.getByText("Current location"));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(position));
  });

  test("applies valid pasted coordinates and rejects invalid input", async () => {
    const onChange = jest.fn();
    await render(<LocationPicker value={null} onChange={onChange} />);

    await fireEvent.press(screen.getByText("Paste coordinates"));
    await fireEvent.changeText(screen.getByLabelText("Latitude and longitude"), "not coordinates");
    await fireEvent.press(screen.getByText("Apply location"));

    expect(screen.getByText("Use latitude first, like 51.0447, -114.0719.")).toBeOnTheScreen();
    expect(onChange).not.toHaveBeenCalled();

    await fireEvent.changeText(
      screen.getByLabelText("Latitude and longitude"),
      "51.06, -114.09",
    );
    await fireEvent.press(screen.getByText("Apply location"));

    expect(onChange).toHaveBeenCalledWith({ latitude: 51.06, longitude: -114.09 });
  });

  test("keeps map movement as a draft until the user confirms it", async () => {
    const onChange = jest.fn();
    await render(<LocationPicker value={null} onChange={onChange} />);

    await fireEvent.press(screen.getByText("Choose on map"));
    expect(screen.getByText("Map type: standard")).toBeOnTheScreen();

    await fireEvent.press(screen.getByText("Satellite"));
    expect(screen.getByText("Map type: satellite")).toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText("Choose spot location on map"));
    expect(onChange).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("Confirm location"));
    expect(onChange).toHaveBeenCalledWith({ latitude: 51.05, longitude: -114.08 });
  });

  test("closing the map discards its draft", async () => {
    const onChange = jest.fn();
    await render(<LocationPicker value={null} onChange={onChange} />);

    await fireEvent.press(screen.getByText("Choose on map"));
    await fireEvent.press(screen.getByLabelText("Choose spot location on map"));
    await fireEvent.press(screen.getByLabelText("Close map"));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText("Confirm location")).not.toBeOnTheScreen();
  });
});
