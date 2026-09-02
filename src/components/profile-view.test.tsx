import type { Id } from "@convex/_generated/dataModel";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { ProfileView } from "./profile-view";

const mockPush = jest.fn();
const mockSignOut = jest.fn();
const mockQueryResults: Record<string, unknown> = {};

jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@clerk/expo", () => ({
  useClerk: () => ({ signOut: mockSignOut }),
  useUser: () => ({
    user: {
      fullName: "Michael Grier",
      primaryEmailAddress: { emailAddress: "michael@example.com" },
    },
  }),
}));
jest.mock("convex/react", () => {
  const { getFunctionName } = jest.requireActual<typeof import("convex/server")>("convex/server");
  return {
    useQuery: (reference: Parameters<typeof getFunctionName>[0]) =>
      mockQueryResults[getFunctionName(reference)],
  };
});

const spot = (id: string, name: string) => ({
  _id: id as Id<"spots">,
  _creationTime: 1,
  name,
  types: ["ledge" as const],
  bustFactor: "medium" as const,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryResults["favorites:list"] = [
    spot("favorite-1", "Harmony Park"),
    spot("favorite-2", "Bowness Curbs"),
  ];
  mockQueryResults["spots:mine"] = [{ status: "active", ...spot("mine-1", "Olympic Plaza Banks") }];
});

describe("ProfileView", () => {
  test("starts on favourites and switches to the user's submitted spots", async () => {
    await render(<ProfileView />);

    expect(
      screen.getByRole("tab", { name: "Favourites, 2 spots" }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(screen.getByText("Harmony Park")).toBeOnTheScreen();
    expect(screen.queryByText("Olympic Plaza Banks")).toBeNull();

    await fireEvent.press(screen.getByRole("tab", { name: "Your spots, 1 spot" }));
    expect(screen.getByText("Olympic Plaza Banks")).toBeOnTheScreen();
    expect(screen.queryByText("Harmony Park")).toBeNull();
  });

  test("opens a saved spot from the active list", async () => {
    await render(<ProfileView />);
    await fireEvent.press(screen.getByText("Harmony Park"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/spot/[id]",
      params: { id: "favorite-1" },
    });
  });

  test("opens the spot standards from the profile shortcut", async () => {
    await render(<ProfileView />);
    await fireEvent.press(screen.getByRole("button", { name: "Spot standards" }));

    expect(mockPush).toHaveBeenCalledWith("/standards");
  });

  test("marks a pending submission as private while it awaits review", async () => {
    mockQueryResults["spots:mine"] = [
      { status: "pending", ...spot("mine-1", "Olympic Plaza Banks") },
    ];
    await render(<ProfileView />);

    await fireEvent.press(screen.getByRole("tab", { name: "Your spots, 1 spot" }));

    expect(screen.getByText("Waiting for review")).toBeOnTheScreen();
    expect(screen.getByText("Visible only to you and administrators")).toBeOnTheScreen();
  });

  test("shows the right empty message for each segment", async () => {
    mockQueryResults["favorites:list"] = [];
    mockQueryResults["spots:mine"] = [];
    await render(<ProfileView />);

    expect(screen.getByText(/No favourites yet/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("tab", { name: "Your spots, 0 spots" }));
    expect(screen.getByText(/Spots you add from the Add tab/)).toBeOnTheScreen();
  });
});
