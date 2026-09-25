import { fireEvent, render, screen } from "@testing-library/react-native";

import { FirstDisplayNameChoice } from "./first-display-name-choice";

const mockSetDisplayName = jest.fn();
const mockSignOut = jest.fn();
let mockProfile: unknown;

jest.mock("@clerk/expo", () => ({
  useClerk: () => ({ signOut: mockSignOut }),
  useUser: () => ({ user: { fullName: "Michael Grier" } }),
}));
jest.mock("convex/react", () => ({
  useMutation: () => mockSetDisplayName,
  useQuery: () => mockProfile,
}));

const unnamed = {
  displayName: "Anonymous Skater 123456",
  anonymousName: "Anonymous Skater 123456",
  hasChosenName: false,
};

beforeEach(() => {
  mockSetDisplayName.mockReset().mockResolvedValue(null);
});

test("asks a new account to choose its provider name or stay anonymous", async () => {
  mockProfile = unnamed;
  await render(<FirstDisplayNameChoice />);
  expect(screen.getByRole("header", { name: "Choose a display name" })).toBeOnTheScreen();
  expect(screen.getByLabelText("Display name")).toHaveDisplayValue("Michael Grier");
  expect(screen.queryByRole("button", { name: /^Cancel$/ })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
  expect(mockSignOut).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Use Anonymous Skater 123456" }));
  expect(screen.getByLabelText("Display name")).toHaveDisplayValue("Anonymous Skater 123456");
  await fireEvent.press(screen.getByRole("button", { name: "Save name" }));
  expect(mockSetDisplayName).toHaveBeenCalledWith({ displayName: "Anonymous Skater 123456" });
});

test("stays hidden when signed out or after a name is chosen", async () => {
  for (const profile of [null, { ...unnamed, hasChosenName: true }]) {
    mockProfile = profile;
    const view = await render(<FirstDisplayNameChoice />);
    expect(screen.queryByLabelText("Display name")).toBeNull();
    await view.unmount();
  }
});
