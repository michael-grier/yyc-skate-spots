import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Linking } from "react-native";

import { SignInView } from "./sign-in-view";

const mockSetActive = jest.fn();
const mockStartAppleAuthenticationFlow = jest.fn();
const mockStartSSOFlow = jest.fn();
const mockIsAppleAuthenticationAvailable = jest.fn();
const mockPush = jest.fn();
const mockOpenUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
const mockSignInWithPassword = jest.fn();

jest.mock("@clerk/expo", () => ({
  useSSO: () => ({ startSSOFlow: mockStartSSOFlow }),
}));
jest.mock("@clerk/expo/apple", () => ({
  useSignInWithApple: () => ({
    startAppleAuthenticationFlow: mockStartAppleAuthenticationFlow,
  }),
}));
jest.mock("expo-apple-authentication", () => {
  const { Pressable, Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    AppleAuthenticationButton: ({
      accessibilityLabel,
      onPress,
    }: {
      accessibilityLabel: string;
      onPress: () => void;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
      >
        <Text>{accessibilityLabel}</Text>
      </Pressable>
    ),
    AppleAuthenticationButtonType: { CONTINUE: "continue" },
    AppleAuthenticationButtonStyle: { WHITE: "white" },
    isAvailableAsync: () => mockIsAppleAuthenticationAvailable(),
  };
});
jest.mock("expo-web-browser", () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@/lib/use-email-code-auth", () => ({
  useEmailCodeAuth: () => ({
    step: { kind: "email" as const },
    error: null,
    busy: false,
    sendCode: jest.fn(),
    verifyCode: jest.fn(),
    signInWithPassword: mockSignInWithPassword,
    resendCode: jest.fn(),
    reset: jest.fn(),
  }),
}));
jest.mock("@/lib/public-site", () => ({
  publicSiteUrl: (page: string) => `https://yycskatespots.com/${page}`,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAppleAuthenticationAvailable.mockResolvedValue(true);
  mockStartAppleAuthenticationFlow.mockResolvedValue({
    createdSessionId: "session_apple",
    setActive: mockSetActive,
  });
  mockStartSSOFlow.mockResolvedValue({
    createdSessionId: "session_google",
    setActive: mockSetActive,
  });
});

describe("SignInView", () => {
  test("keeps privacy, support, and spot standards available without signing in", async () => {
    await render(<SignInView />);

    await fireEvent.press(screen.getByRole("link", { name: "Privacy" }));
    await fireEvent.press(screen.getByRole("link", { name: "Support" }));
    await fireEvent.press(screen.getByRole("link", { name: "Spot standards" }));

    expect(mockOpenUrl).toHaveBeenNthCalledWith(1, "https://yycskatespots.com/privacy");
    expect(mockOpenUrl).toHaveBeenNthCalledWith(2, "https://yycskatespots.com/support");
    expect(mockPush).toHaveBeenCalledWith("/standards");
  });

  test("activates the session returned by native Apple authentication", async () => {
    await render(<SignInView />);

    await act(async () => {
      fireEvent.press(await screen.findByRole("button", { name: "Continue with Apple" }));
    });

    await waitFor(() => {
      expect(mockStartAppleAuthenticationFlow).toHaveBeenCalledTimes(1);
      expect(mockSetActive).toHaveBeenCalledWith({ session: "session_apple" });
    });
  });

  test("treats a cancelled Apple prompt as a quiet no-op", async () => {
    mockStartAppleAuthenticationFlow.mockRejectedValue({
      code: "ERR_REQUEST_CANCELED",
      message: "The user canceled the authorization attempt.",
    });
    await render(<SignInView />);

    await act(async () => {
      fireEvent.press(await screen.findByRole("button", { name: "Continue with Apple" }));
    });

    await waitFor(() => expect(mockStartAppleAuthenticationFlow).toHaveBeenCalledTimes(1));
    expect(mockSetActive).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("uses the production-allowlisted callback for Google SSO", async () => {
    await render(<SignInView />);

    await act(async () => {
      fireEvent.press(screen.getByRole("button", { name: "Continue with Google" }));
    });

    await waitFor(() => {
      expect(mockStartSSOFlow).toHaveBeenCalledWith({
        strategy: "oauth_google",
        redirectUrl: "yycskatespots://sso-callback",
      });
      expect(mockSetActive).toHaveBeenCalledWith({ session: "session_google" });
    });
  });

  test("offers password sign-in without changing the default email-code flow", async () => {
    await render(<SignInView />);
    await screen.findByRole("button", { name: "Continue with Apple" });

    expect(screen.getByRole("button", { name: "Continue" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Sign in with a password" }));

    await fireEvent.changeText(screen.getByLabelText("Email address"), "reviewer@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "review password");
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(mockSignInWithPassword).toHaveBeenCalledWith(
        "reviewer@example.com",
        "review password",
      ),
    );

    await fireEvent.press(screen.getByRole("button", { name: "Use an email code instead" }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeOnTheScreen();
    expect(screen.queryByLabelText("Password")).toBeNull();
  });
});
