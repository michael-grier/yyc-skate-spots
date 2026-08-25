import type { Id } from "@convex/_generated/dataModel";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import SpotDetailScreen from "@/app/spot/[id]";

const mockPush = jest.fn();
const mockToggleFavorite = jest.fn();
const mockRemoveSpot = jest.fn();
const mockAuthState = { isLoaded: true, isSignedIn: false };
const mockSpot = {
  _id: "spot-1" as Id<"spots">,
  _creationTime: 1,
  name: "Harmony Park",
  types: ["ledge" as const],
  bustFactor: "medium" as const,
  surface: "smooth" as const,
  latitude: 51.0447,
  longitude: -114.0719,
  photoUrls: [],
  photoIds: null,
  isOwner: false,
  isFavorite: false,
};

jest.mock("@clerk/expo", () => ({ useAuth: () => mockAuthState }));
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: "spot-1" }),
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
}));
jest.mock("convex/react", () => {
  const { getFunctionName } = jest.requireActual<typeof import("convex/server")>("convex/server");
  return {
    useQuery: () => mockSpot,
    useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
      getFunctionName(reference) === "favorites:toggle" ? mockToggleFavorite : mockRemoveSpot,
  };
});
jest.mock("@/components/photo-carousel", () => ({ PhotoCarousel: () => null }));
jest.mock("@/lib/use-spot-address", () => ({ useSpotAddress: () => null }));
jest.mock("@/lib/use-user-location", () => ({
  useUserLocation: () => ({ coords: null, granted: false }),
}));
jest.mock("@/lib/open-directions", () => ({ openDirections: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthState.isLoaded = true;
  mockAuthState.isSignedIn = false;
  mockToggleFavorite.mockResolvedValue(true);
});

describe("SpotDetailScreen favourites", () => {
  test("offers the existing Account route when the caller is signed out", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<SpotDetailScreen />);

    await fireEvent.press(screen.getByRole("button", { name: "Add to favourites" }));
    const actions = alertSpy.mock.calls[0][2];
    actions?.find((action) => action.text === "Sign in")?.onPress?.();

    expect(mockPush).toHaveBeenCalledWith("/account");
    expect(mockToggleFavorite).not.toHaveBeenCalled();
  });

  test("calls the protected mutation for a signed-in user", async () => {
    mockAuthState.isSignedIn = true;
    await render(<SpotDetailScreen />);

    await fireEvent.press(screen.getByRole("button", { name: "Add to favourites" }));
    await waitFor(() => expect(mockToggleFavorite).toHaveBeenCalledWith({ spotId: "spot-1" }));
  });
});
