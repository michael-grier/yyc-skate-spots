import type { Id } from "@convex/_generated/dataModel";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert, Linking } from "react-native";

import { ProfileView } from "./profile-view";

const mockPush = jest.fn();
const mockSignOut = jest.fn();
const mockSetActive = jest.fn();
const mockDeleteAccount = jest.fn();
const mockSetDisplayName = jest.fn();
const mockAppleRefresh = jest.fn();
const mockOpenUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
const mockQueryResults: Record<string, unknown> = {};
const mockAlert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@clerk/expo", () => ({
  useClerk: () => ({ setActive: mockSetActive, signOut: mockSignOut }),
  useUser: () => ({
    user: {
      fullName: "Michael Grier",
      primaryEmailAddress: { emailAddress: "michael@example.com" },
    },
  }),
}));
jest.mock("expo-apple-authentication", () => ({
  refreshAsync: (options: { user: string }) => mockAppleRefresh(options),
}));
jest.mock("convex/react", () => {
  const { getFunctionName } = jest.requireActual<typeof import("convex/server")>("convex/server");
  return {
    useAction: () => mockDeleteAccount,
    useMutation: () => mockSetDisplayName,
    useQuery: (reference: Parameters<typeof getFunctionName>[0]) =>
      mockQueryResults[getFunctionName(reference)],
  };
});
jest.mock("@/lib/public-site", () => ({
  publicSiteUrl: (page: string) => `https://yycskatespots.com/${page}`,
}));

const spot = (id: string, name: string) => ({
  _id: id as Id<"spots">,
  _creationTime: 1,
  name,
  types: ["ledge" as const],
  bustFactor: "medium" as const,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSetDisplayName.mockReset().mockResolvedValue(null);
  mockQueryResults["profiles:me"] = { displayName: "Michael Grier" };
  mockDeleteAccount.mockResolvedValue({ status: "complete" });
  mockSetActive.mockResolvedValue(undefined);
  mockSignOut.mockResolvedValue(undefined);
  mockQueryResults["favorites:list"] = [
    spot("favorite-1", "Harmony Park"),
    spot("favorite-2", "Bowness Curbs"),
  ];
  mockQueryResults["spots:mine"] = [{ status: "active", ...spot("mine-1", "Olympic Plaza Banks") }];
});

async function acceptDeletionConfirmation() {
  const buttons = mockAlert.mock.calls[0]?.[2];
  const destructiveButton = buttons?.find((button) => button.style === "destructive");
  if (!destructiveButton?.onPress) {
    throw new Error("Expected a destructive account-deletion confirmation.");
  }
  await act(async () => {
    await destructiveButton.onPress?.();
  });
}

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

  test("opens privacy, support, and spot standards from the compact footer", async () => {
    await render(<ProfileView />);

    await fireEvent.press(screen.getByRole("link", { name: "Privacy" }));
    await fireEvent.press(screen.getByRole("link", { name: "Support" }));
    await fireEvent.press(screen.getByRole("link", { name: "Spot standards" }));

    expect(mockOpenUrl).toHaveBeenNthCalledWith(1, "https://yycskatespots.com/privacy");
    expect(mockOpenUrl).toHaveBeenNthCalledWith(2, "https://yycskatespots.com/support");
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

  test("keeps account deletion at the bottom and explains its consequences", async () => {
    await render(<ProfileView />);

    expect(screen.getByRole("button", { name: "Sign out" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));

    expect(mockAlert).toHaveBeenCalledWith(
      "Delete account?",
      expect.stringMatching(/submitted spots, photos, favourites, reports, and moderation history/),
      expect.arrayContaining([
        expect.objectContaining({ text: "Cancel", style: "cancel" }),
        expect.objectContaining({ text: "Delete account", style: "destructive" }),
      ]),
    );
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  test("deletes a non-Apple account, clears the session, and confirms completion", async () => {
    await render(<ProfileView />);
    await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
    await acceptDeletionConfirmation();

    await waitFor(() => expect(mockDeleteAccount).toHaveBeenCalledWith({}));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
    expect(mockSetActive).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenLastCalledWith(
      "Account deleted",
      "Your account and all associated data have been permanently deleted.",
    );
  });

  test("clears the local session if Clerk no longer recognizes the deleted session", async () => {
    mockSignOut.mockRejectedValue(new Error("Session not found"));
    await render(<ProfileView />);
    await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
    await acceptDeletionConfirmation();

    await waitFor(() => expect(mockSetActive).toHaveBeenCalledWith({ session: null }));
    expect(mockAlert).toHaveBeenLastCalledWith(
      "Account deleted",
      "Your account and all associated data have been permanently deleted.",
    );
  });

  test("still confirms deletion if both local session cleanup methods fail", async () => {
    mockSignOut.mockRejectedValue(new Error("Session not found"));
    mockSetActive.mockRejectedValue(new Error("Session cache unavailable"));
    await render(<ProfileView />);
    await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
    await acceptDeletionConfirmation();

    await waitFor(() => expect(mockSetActive).toHaveBeenCalledWith({ session: null }));
    expect(mockAlert).toHaveBeenLastCalledWith(
      "Account deleted",
      "Your account and all associated data have been permanently deleted.",
    );
  });

  test("reauthorizes and passes a fresh code when the server finds an Apple account", async () => {
    mockDeleteAccount
      .mockResolvedValueOnce({ status: "appleAuthorizationRequired", appleUserId: "apple-user" })
      .mockResolvedValueOnce({ status: "complete" });
    mockAppleRefresh.mockResolvedValue({ authorizationCode: "fresh-code" });
    await render(<ProfileView />);
    await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
    await acceptDeletionConfirmation();

    await waitFor(() => expect(mockAppleRefresh).toHaveBeenCalledWith({ user: "apple-user" }));
    expect(mockDeleteAccount).toHaveBeenNthCalledWith(1, {});
    expect(mockDeleteAccount).toHaveBeenNthCalledWith(2, {
      appleAuthorizationCode: "fresh-code",
    });
    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
  });

  test("leaves the account alone when Apple reauthorization is cancelled", async () => {
    mockDeleteAccount.mockResolvedValueOnce({
      status: "appleAuthorizationRequired",
      appleUserId: "apple-user",
    });
    mockAppleRefresh.mockRejectedValue(
      Object.assign(new Error("Cancelled"), { code: "ERR_REQUEST_CANCELED" }),
    );
    await render(<ProfileView />);
    await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
    await acceptDeletionConfirmation();

    await waitFor(() => expect(mockAppleRefresh).toHaveBeenCalledTimes(1));
    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText("Delete account")).toBeOnTheScreen());
  });

  test("keeps retry available when deletion cannot be confirmed", async () => {
    mockDeleteAccount.mockRejectedValue(new Error("Clerk unavailable"));
    await render(<ProfileView />);
    await fireEvent.press(screen.getByRole("button", { name: "Delete account" }));
    await acceptDeletionConfirmation();

    await waitFor(() =>
      expect(mockAlert).toHaveBeenLastCalledWith(
        "Couldn’t delete account",
        expect.stringMatching(/safely resume/),
      ),
    );
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete account" })).not.toBeDisabled();
  });
});

describe("display name editor", () => {
  test("prefills the saved name and Cancel discards the draft", async () => {
    await render(<ProfileView />);
    await fireEvent.press(screen.getByRole("button", { name: "Edit display name" }));
    expect(screen.getByLabelText("Display name")).toHaveDisplayValue("Michael Grier");
    await fireEvent.changeText(screen.getByLabelText("Display name"), "Draft");
    await fireEvent.press(screen.getByRole("button", { name: /^Cancel$/ }));
    expect(mockSetDisplayName).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Edit display name" }));
    expect(screen.getByLabelText("Display name")).toHaveDisplayValue("Michael Grier");
  });

  test("lets an email-code account choose a name without using its email", async () => {
    mockQueryResults["profiles:me"] = { displayName: null };
    await render(<ProfileView />);
    await fireEvent.press(screen.getByRole("button", { name: "Edit display name" }));
    expect(screen.getByLabelText("Display name")).toHaveDisplayValue("");
    await fireEvent.changeText(screen.getByLabelText("Display name"), "  Skater  ");
    await fireEvent.press(screen.getByRole("button", { name: "Save name" }));
    expect(mockSetDisplayName).toHaveBeenCalledWith({ displayName: "Skater" });
    await waitFor(() => expect(screen.queryByLabelText("Display name")).toBeNull());
  });

  test("keeps invalid drafts open and allows retry after a save failure", async () => {
    mockSetDisplayName.mockRejectedValueOnce(new Error("offline"));
    await render(<ProfileView />);
    await fireEvent.press(screen.getByRole("button", { name: "Edit display name" }));
    await fireEvent.changeText(screen.getByLabelText("Display name"), "private@example.com");
    await fireEvent.press(screen.getByRole("button", { name: "Save name" }));
    expect(mockSetDisplayName).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Use letters/);
    await fireEvent.changeText(screen.getByLabelText("Display name"), "New Name");
    await fireEvent.press(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Couldn't save/));
    expect(screen.getByLabelText("Display name")).toHaveDisplayValue("New Name");
    await fireEvent.press(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() => expect(screen.queryByLabelText("Display name")).toBeNull());
  });

  test("prevents duplicate saves and dismissal while a save is in flight", async () => {
    let completeSave!: (value: null) => void;
    mockSetDisplayName.mockImplementationOnce(
      () =>
        new Promise<null>((resolve) => {
          completeSave = resolve;
        }),
    );
    await render(<ProfileView />);
    await fireEvent.press(screen.getByRole("button", { name: "Edit display name" }));
    await fireEvent(screen.getByLabelText("Display name"), "submitEditing");
    await fireEvent(screen.getByLabelText("Display name"), "submitEditing");
    expect(mockSetDisplayName).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Cancel$/ })).toBeDisabled();
    await act(async () => completeSave(null));
    await waitFor(() => expect(screen.queryByLabelText("Display name")).toBeNull());
  });

  test("reflects a reactive name change on Profile", async () => {
    const view = await render(<ProfileView />);
    mockQueryResults["profiles:me"] = { displayName: "Renamed Skater" };
    await view.rerender(<ProfileView />);
    expect(screen.getByText("Renamed Skater")).toBeOnTheScreen();
    expect(screen.queryByText("Michael Grier")).toBeNull();
  });
});
