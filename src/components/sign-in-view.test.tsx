import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { SignInView } from "./sign-in-view";

const mockSetActive = jest.fn();
const mockStartAppleAuthenticationFlow = jest.fn();
const mockStartSSOFlow = jest.fn();
const mockIsAppleAuthenticationAvailable = jest.fn();

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
    resendCode: jest.fn(),
    reset: jest.fn(),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAppleAuthenticationAvailable.mockResolvedValue(true);
  mockStartAppleAuthenticationFlow.mockResolvedValue({
    createdSessionId: "session_apple",
    setActive: mockSetActive,
  });
  mockStartSSOFlow.mockResolvedValue({ createdSessionId: "session_google" });
});

describe("SignInView", () => {
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
    mockStartAppleAuthenticationFlow.mockResolvedValue({
      createdSessionId: null,
      setActive: mockSetActive,
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
    });
  });
});
