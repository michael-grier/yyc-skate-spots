import { fireEvent, render, screen } from "@testing-library/react-native";

import { LocationPicker } from "./location-picker";

const mockAnimateToRegion = jest.fn();

jest.mock("react-native-maps", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { Pressable } = jest.requireActual<typeof import("react-native")>("react-native");

  type MockMapProps = {
    onRegionChangeComplete?: (
      region: {
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
      },
      details: { isGesture: boolean },
    ) => void;
  };

  const MockMap = React.forwardRef(function MockMap(
    { onRegionChangeComplete }: MockMapProps,
    ref: React.ForwardedRef<{ animateToRegion: typeof mockAnimateToRegion }>,
  ) {
    React.useImperativeHandle(ref, () => ({ animateToRegion: mockAnimateToRegion }));
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Map"
        onPress={() =>
          onRegionChangeComplete?.(
            {
              latitude: 51.05,
              longitude: -114.08,
              latitudeDelta: 0.004,
              longitudeDelta: 0.004,
            },
            { isGesture: true },
          )
        }
      />
    );
  });

  return { __esModule: true, default: MockMap, PROVIDER_GOOGLE: "google" };
});

jest.mock("@/lib/use-user-location", () => ({
  useUserLocation: () => ({ coords: null, granted: false, locate: jest.fn() }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("LocationPicker", () => {
  test("applies a pasted coordinate pair and moves the map preview", async () => {
    const onChange = jest.fn();
    await render(<LocationPicker value={null} onChange={onChange} />);

    await fireEvent.press(screen.getByText("Or paste coordinates instead"));
    await fireEvent.changeText(screen.getByLabelText("Latitude and longitude"), "51.06, -114.09");
    await fireEvent.press(screen.getByText("Apply to map"));

    expect(onChange).toHaveBeenCalledWith({ latitude: 51.06, longitude: -114.09 });
    expect(mockAnimateToRegion).toHaveBeenCalledWith(
      {
        latitude: 51.06,
        longitude: -114.09,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      },
      300,
    );
    expect(screen.getByLabelText("Latitude and longitude")).toHaveProp(
      "value",
      "51.060000, -114.090000",
    );
  });

  test("keeps the current location when pasted coordinates are invalid", async () => {
    const onChange = jest.fn();
    await render(
      <LocationPicker value={{ latitude: 51.04, longitude: -114.07 }} onChange={onChange} />,
    );

    await fireEvent.press(screen.getByText("Or paste coordinates instead"));
    await fireEvent.changeText(screen.getByLabelText("Latitude and longitude"), "not coordinates");
    await fireEvent.press(screen.getByText("Apply to map"));

    expect(screen.getByText("Use latitude first, like 51.0447, -114.0719.")).toBeOnTheScreen();
    expect(onChange).not.toHaveBeenCalled();
    expect(mockAnimateToRegion).not.toHaveBeenCalled();
  });

  test("keeps map dragging as the other way to set the same location", async () => {
    const onChange = jest.fn();
    const view = await render(<LocationPicker value={null} onChange={onChange} />);

    await fireEvent.press(screen.getByLabelText("Map"));
    await view.rerender(
      <LocationPicker value={{ latitude: 51.05, longitude: -114.08 }} onChange={onChange} />,
    );
    await fireEvent.press(screen.getByText("Or paste coordinates instead"));

    expect(onChange).toHaveBeenCalledWith({ latitude: 51.05, longitude: -114.08 });
    expect(screen.getByLabelText("Latitude and longitude")).toHaveProp(
      "value",
      "51.050000, -114.080000",
    );
    await fireEvent.press(screen.getByText("How to copy from Google or Apple Maps"));
    expect(screen.getByText("Google Maps: ")).toBeOnTheScreen();
    expect(screen.getByText("Apple Maps: ")).toBeOnTheScreen();
  });
});
