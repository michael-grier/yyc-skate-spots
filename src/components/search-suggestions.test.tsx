import { fireEvent, render, screen } from "@testing-library/react-native";

import { SearchSuggestions } from "./search-suggestions";

const SUGGESTIONS = [
  { _id: "a", name: "Harmony Park", types: ["ledge" as const], bustFactor: "medium" as const, distanceKm: 0.4 },
  { _id: "b", name: "Bowness Curbs", types: ["curb" as const], bustFactor: "low" as const },
];

describe("SearchSuggestions", () => {
  test("lists matches with their types and distance, and reports the pick", async () => {
    const onPick = jest.fn();
    await render(<SearchSuggestions suggestions={SUGGESTIONS} onPick={onPick} />);

    expect(screen.getByText(/Ledge · 400 m/)).toBeOnTheScreen();
    // No distance line segment when the user's location is unknown.
    expect(screen.getByText("Curb")).toBeOnTheScreen();

    await fireEvent.press(screen.getByText("Bowness Curbs"));
    expect(onPick).toHaveBeenCalledWith("b");
  });

  test("empty results explain themselves", async () => {
    await render(<SearchSuggestions suggestions={[]} onPick={jest.fn()} />);
    expect(screen.getByText(/No spots match/)).toBeOnTheScreen();
  });
});
