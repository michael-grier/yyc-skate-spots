import type { Id } from "@convex/_generated/dataModel";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, Share } from "react-native";

import SpotDetailScreen from "@/app/spot/[id]";

const mockPush = jest.fn();
const mockToggleFavorite = jest.fn();
const mockRemoveSpot = jest.fn();
const mockMarkPhotosSeen = jest.fn();
const mockSetPhotoPermission = jest.fn();
const mockSetNeedsWork = jest.fn();
const mockAcknowledgeStandards = jest.fn();
const mockViewer = { isBanned: false, hasAcknowledgedStandards: true };
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
  isPendingReview: false,
  status: "active" as const,
  adminPhotosUnseen: false,
  adminPhotosAddedAt: 123,
  allowAdminPhotos: false,
  needsWork: false,
  isFixed: false,
  notes: undefined as string | undefined,
  fix: null,
  pendingFix: null as "mine" | "other" | null,
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
    useQuery: (reference: Parameters<typeof getFunctionName>[0]) =>
      getFunctionName(reference) === "moderation:viewer" ? mockViewer : mockSpot,
    useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
      const name = getFunctionName(reference);
      if (name === "favorites:toggle") return mockToggleFavorite;
      if (name === "spots:markAdminPhotosSeen") return mockMarkPhotosSeen;
      if (name === "spots:setAdminPhotoPermission") return mockSetPhotoPermission;
      if (name === "spots:setNeedsWork") return mockSetNeedsWork;
      if (name === "moderation:acknowledgeStandards") return mockAcknowledgeStandards;
      return mockRemoveSpot;
    },
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
  mockSpot.isOwner = false;
  mockSpot.isPendingReview = false;
  mockSpot.adminPhotosUnseen = false;
  mockSpot.allowAdminPhotos = false;
  mockSpot.needsWork = false;
  mockSpot.isFixed = false;
  mockSpot.notes = undefined;
  mockSpot.pendingFix = null;
  mockViewer.hasAcknowledgedStandards = true;
  mockSetNeedsWork.mockResolvedValue(null);
  mockAcknowledgeStandards.mockResolvedValue(null);
  mockMarkPhotosSeen.mockResolvedValue(null);
  mockSetPhotoPermission.mockResolvedValue(null);
  mockToggleFavorite.mockResolvedValue(true);
  process.env.EXPO_PUBLIC_SHARE_BASE_URL = "https://share.example.com";
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

describe("SpotDetailScreen sharing", () => {
  test("shares a public link while signed out", async () => {
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction });
    await render(<SpotDetailScreen />);

    fireEvent.press(screen.getByRole("button", { name: "Share spot" }));

    await waitFor(() =>
      expect(shareSpy).toHaveBeenCalledWith({
        message: "Check out Harmony Park on YYC Skate Spots.",
        url: "https://share.example.com/share?id=spot-1",
      }),
    );
    expect(mockToggleFavorite).not.toHaveBeenCalled();
  });

  test("reports a share-sheet failure", async () => {
    jest.spyOn(Share, "share").mockRejectedValue(new Error("unavailable"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await render(<SpotDetailScreen />);

    fireEvent.press(screen.getByRole("button", { name: "Share spot" }));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Couldn't share this spot",
        "Check your connection and try again.",
      ),
    );
  });
});

describe("SpotDetailScreen moderation status", () => {
  test("tells the owner a pending version is private", async () => {
    mockSpot.isOwner = true;
    mockSpot.isPendingReview = true;
    await render(<SpotDetailScreen />);

    expect(screen.getByText("Waiting for review")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "This version is awaiting admin approval. Until then, it is visible only to you and administrators.",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Share spot" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add to favourites" })).toBeNull();
  });
});

test.each([false, true])(
  "retains the report destination when signed in is %s",
  async (signedIn) => {
    mockAuthState.isSignedIn = signedIn;
    await render(<SpotDetailScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Report this spot" }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/spot/report/[id]",
      params: { id: "spot-1" },
    });
  },
);

test("acknowledges admin photos only when the owner opens them", async () => {
  mockAuthState.isSignedIn = true;
  mockSpot.adminPhotosUnseen = true;
  await render(<SpotDetailScreen />);
  expect(mockMarkPhotosSeen).not.toHaveBeenCalled();
  mockSpot.isOwner = true;
  await screen.rerender(<SpotDetailScreen />);
  await waitFor(() =>
    expect(mockMarkPhotosSeen).toHaveBeenCalledWith({ id: "spot-1", addedAt: 123 }),
  );
});

test("lets the owner withdraw unused photo permission", async () => {
  mockAuthState.isSignedIn = true;
  mockSpot.isOwner = true;
  mockSpot.allowAdminPhotos = true;
  await render(<SpotDetailScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Withdraw photo permission" }));
  expect(mockSetPhotoPermission).toHaveBeenCalledWith({ id: "spot-1", allowed: false });
});

test("lets the owner remove the needs work tag from the card", async () => {
  mockAuthState.isSignedIn = true;
  mockSpot.isOwner = true;
  mockSpot.needsWork = true;
  await render(<SpotDetailScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Remove needs work tag" }));
  expect(mockSetNeedsWork).toHaveBeenCalledWith({ id: "spot-1", needsWork: false });
});

test("asks for the current standards before tagging, then tags", async () => {
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  mockAuthState.isSignedIn = true;
  mockSpot.isOwner = true;
  mockSpot.notes = "Patch the crack in the landing.";
  mockViewer.hasAcknowledgedStandards = false;
  await render(<SpotDetailScreen />);

  await fireEvent.press(screen.getByRole("button", { name: "Spot options" }));
  const menu = alertSpy.mock.calls[0][2];
  await act(() => menu?.find((action) => action.text === "Tag as needs work")?.onPress?.());
  const confirm = alertSpy.mock.calls[1][2];
  await act(() => confirm?.find((action) => action.text === "Tag it")?.onPress?.());
  expect(mockSetNeedsWork).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole("button", { name: "Agree and submit" }));
  await waitFor(() =>
    expect(mockSetNeedsWork).toHaveBeenCalledWith({ id: "spot-1", needsWork: true }),
  );
  expect(mockAcknowledgeStandards).toHaveBeenCalledTimes(1);
});

test("a fixed spot can't be tagged again", async () => {
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  mockAuthState.isSignedIn = true;
  mockSpot.isOwner = true;
  mockSpot.notes = "Patch the crack in the landing.";
  mockSpot.isFixed = true;
  await render(<SpotDetailScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Spot options" }));
  const menu = alertSpy.mock.calls[0][2];
  expect(menu?.some((action) => action.text === "Tag as needs work")).toBe(false);
});

test("a visitor opens the fix form from a tagged spot", async () => {
  mockSpot.needsWork = true;
  await render(<SpotDetailScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Send photos of your fix" }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/spot/fix/[id]", params: { id: "spot-1" } });
});

test("the owner can't remove the tag while a fix waits for review", async () => {
  mockAuthState.isSignedIn = true;
  mockSpot.isOwner = true;
  mockSpot.needsWork = true;
  mockSpot.pendingFix = "other";
  await render(<SpotDetailScreen />);
  expect(
    screen.getByText("Someone sent photos of a fix. An admin is checking them."),
  ).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Remove needs work tag" })).toBeNull();
});
