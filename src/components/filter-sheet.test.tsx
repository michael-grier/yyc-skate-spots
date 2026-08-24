import { fireEvent, render, screen } from "@testing-library/react-native";

import { DEFAULT_FILTERS, type SpotFilters } from "@/lib/spot-filters";

import { FilterSheet } from "./filter-sheet";

// The sheet's behaviour under test is filter editing, not gestures: render
// the modal's children inline and drop the backdrop.
jest.mock("@gorhom/bottom-sheet", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    BottomSheetModal: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    BottomSheetView: View,
    BottomSheetBackdrop: () => null,
  };
});

function renderSheet(filters: SpotFilters, overrides: Partial<Parameters<typeof FilterSheet>[0]> = {}) {
  const onChange = jest.fn();
  const props = {
    ref: null,
    filters,
    onChange,
    resultCount: 4,
    hasLocation: true,
    onRequestLocation: jest.fn(),
    onDone: jest.fn(),
    ...overrides,
  };
  const result = render(<FilterSheet {...props} />);
  return { onChange, props, result };
}

describe("FilterSheet", () => {
  test("types are any-of toggles: tap to add, tap again to remove", async () => {
    const first = renderSheet({ ...DEFAULT_FILTERS, types: ["curb"] });
    await first.result;
    await fireEvent.press(screen.getByText("Ledge"));
    expect(first.onChange).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, types: ["curb", "ledge"] });

    await fireEvent.press(screen.getByText("Curb"));
    expect(first.onChange).toHaveBeenLastCalledWith({ ...DEFAULT_FILTERS, types: [] });
  });

  test("distance presets are one-of and Any clears the radius", async () => {
    const { onChange, result } = renderSheet({ ...DEFAULT_FILTERS, maxDistanceKm: 5 });
    await result;
    await fireEvent.press(screen.getByText("10 km"));
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, maxDistanceKm: 10 });
    await fireEvent.press(screen.getByText("Any"));
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_FILTERS, maxDistanceKm: null });
  });

  test("reset clears the chips but preserves the search query", async () => {
    const active = { query: "bmo", maxDistanceKm: 5, types: ["ledge" as const], bustFactors: ["low" as const] };
    const { onChange, result } = renderSheet(active);
    await result;
    await fireEvent.press(screen.getByText("Reset"));
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, query: "bmo" });
  });

  test("without a location the distance section offers to turn it on", async () => {
    const onRequestLocation = jest.fn();
    const { result } = renderSheet(DEFAULT_FILTERS, { hasLocation: false, onRequestLocation });
    await result;
    await fireEvent.press(screen.getByText(/turn it on/));
    expect(onRequestLocation).toHaveBeenCalledTimes(1);
  });

  test("the primary button reports the live count and dismisses", async () => {
    const onDone = jest.fn();
    const { result } = renderSheet(DEFAULT_FILTERS, { resultCount: 1, onDone });
    await result;
    await fireEvent.press(screen.getByText("Show 1 spot"));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
