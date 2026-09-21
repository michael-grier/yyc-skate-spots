import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AppState, Linking } from "react-native";

import { SignInView } from "./sign-in-view";

const mockSetActive = jest.fn();
const mockStartAppleAuthenticationFlow = jest.fn();
const mockStartSSOFlow = jest.fn();
const mockIsAppleAuthenticationAvailable = jest.fn();
const mockPush = jest.fn();
type TabState = { index: number; routes: { name: string }[] };
const mockNavigationListeners = new Set<(event: { data: { state: TabState } }) => void>();
let mockTabState: TabState;
const mockNavigation = {
  getState: () => mockTabState,
  addListener: (_event: string, callback: (event: { data: { state: TabState } }) => void) => {
    mockNavigationListeners.add(callback);
    return () => mockNavigationListeners.delete(callback);
  },
};
async function switchTab(index: number) {
  mockTabState = { ...mockTabState, index };
  await act(() => {
    for (const listener of mockNavigationListeners) listener({ data: { state: mockTabState } });
  });
}
const mockOpenUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
const mockSignIn = {
  status: "complete",
  password: jest.fn(),
  create: jest.fn(),
  reset: jest.fn(),
  finalize: jest.fn(),
  emailCode: { sendCode: jest.fn(), verifyCode: jest.fn() },
  resetPasswordEmailCode: { sendCode: jest.fn(), verifyCode: jest.fn(), submitPassword: jest.fn() },
};
const mockSignUp = {
  create: jest.fn(),
  reset: jest.fn(),
  finalize: jest.fn(),
  verifications: { sendEmailCode: jest.fn(), verifyEmailCode: jest.fn() },
};

jest.mock("@clerk/expo", () => ({
  useSignIn: () => ({ signIn: mockSignIn }),
  useSignUp: () => ({ signUp: mockSignUp }),
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
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useNavigation: () => mockNavigation,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@/lib/public-site", () => ({
  publicSiteUrl: (page: string) => `https://yycskatespots.com/${page}`,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigationListeners.clear();
  mockTabState = { index: 2, routes: [{ name: "index" }, { name: "add" }, { name: "account" }] };
  for (const fn of [
    mockSignIn.password,
    mockSignIn.create,
    mockSignIn.reset,
    mockSignIn.finalize,
    mockSignIn.emailCode.sendCode,
    mockSignIn.emailCode.verifyCode,
    mockSignIn.resetPasswordEmailCode.sendCode,
    mockSignIn.resetPasswordEmailCode.verifyCode,
    mockSignIn.resetPasswordEmailCode.submitPassword,
    mockSignUp.reset,
    mockSignUp.create,
    mockSignUp.finalize,
    mockSignUp.verifications.sendEmailCode,
    mockSignUp.verifications.verifyEmailCode,
  ])
    fn.mockResolvedValue({ error: null });
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

    await fireEvent(screen.getByLabelText("Password"), "submitEditing");
    expect(mockSignIn.password).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText("Email address"), "reviewer@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "review password");
    await fireEvent(screen.getByLabelText("Password"), "submitEditing");

    await waitFor(() =>
      expect(mockSignIn.password).toHaveBeenCalledWith({
        emailAddress: "reviewer@example.com",
        password: "review password",
      }),
    );

    await fireEvent.press(screen.getByRole("button", { name: "Use an email code instead" }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeOnTheScreen();
    expect(screen.queryByLabelText("Password")).toBeNull();
  });

  test("a failed password attempt can return to the main sign-in screen", async () => {
    mockSignIn.password.mockResolvedValue({
      error: { code: "form_password_incorrect", message: "Wrong password" },
    });
    await render(<SignInView />);
    await fireEvent.press(screen.getByRole("button", { name: "Sign in with a password" }));
    await fireEvent.changeText(screen.getByLabelText("Email address"), "wrong@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "wrong");
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That email or password isn't right.",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Back to sign in" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeOnTheScreen();
    expect(mockSignIn.reset).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByRole("button", { name: "Sign in with a password" }));
    expect(screen.getByLabelText("Password")).toHaveProp("value", "");
  });

  test("a failed email code can start over with another account and an empty code", async () => {
    mockSignIn.emailCode.verifyCode.mockResolvedValueOnce({
      error: { code: "form_code_incorrect", message: "Wrong code" },
    });
    await render(<SignInView />);
    await fireEvent.changeText(screen.getByLabelText("Email address"), "first@example.com");
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    await fireEvent.changeText(screen.getByLabelText("Verification code"), "000000");
    await fireEvent.press(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That code isn't right. Check it and try again.",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Back to sign in" }));
    await fireEvent.changeText(screen.getByLabelText("Email address"), "second@example.com");
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(mockSignIn.emailCode.sendCode).toHaveBeenLastCalledWith({
      emailAddress: "second@example.com",
    });
    expect(screen.getByLabelText("Verification code")).toHaveProp("value", "");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("a failed reset preserves the current method until the user retries", async () => {
    await render(<SignInView />);
    await fireEvent.press(screen.getByRole("button", { name: "Sign in with a password" }));
    await fireEvent.changeText(screen.getByLabelText("Password"), "existing password");
    mockSignUp.reset.mockResolvedValueOnce({ error: { message: "Reset failed" } });

    await fireEvent.press(screen.getByRole("button", { name: "Back to sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Reset failed");
    expect(screen.getByLabelText("Password")).toHaveProp("value", "existing password");

    await fireEvent.press(screen.getByRole("button", { name: "Back to sign in" }));
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test.each(["returned", "rejected"])(
    "a %s tab reset failure hides the old code screen and offers a retry",
    async (failure) => {
      await render(<SignInView />);
      await fireEvent.changeText(screen.getByLabelText("Email address"), "skater@example.com");
      await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
      await fireEvent.changeText(screen.getByLabelText("Verification code"), "123456");
      if (failure === "returned") {
        mockSignIn.reset.mockResolvedValueOnce({ error: { message: "Reset failed" } });
      } else {
        mockSignIn.reset.mockRejectedValueOnce(new Error("Reset failed"));
      }

      await switchTab(0);
      await switchTab(2);
      expect(screen.queryByLabelText("Verification code")).toBeNull();
      expect(screen.getByRole("alert")).toHaveTextContent("Reset failed");
      expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
      expect(mockSignIn.reset).toHaveBeenCalledTimes(1);

      await fireEvent.press(screen.getByRole("button", { name: "Retry sign-in reset" }));
      expect(mockSignIn.reset).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
      await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
      expect(screen.getByLabelText("Verification code")).toHaveProp("value", "");
    },
  );

  test("recovers a forgotten password through an emailed code", async () => {
    await render(<SignInView />);
    await fireEvent.press(screen.getByRole("button", { name: "Sign in with a password" }));
    await fireEvent.changeText(screen.getByLabelText("Email address"), "skater@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "forgotten password");
    await fireEvent.press(screen.getByRole("button", { name: "Forgot password?" }));
    await fireEvent.press(screen.getByRole("button", { name: "Send reset code" }));
    await fireEvent.changeText(screen.getByLabelText("Verification code"), "123456");
    await fireEvent.press(screen.getByRole("button", { name: "Verify" }));
    expect(screen.getByLabelText("New password")).toHaveProp("value", "");
    await fireEvent.changeText(screen.getByLabelText("New password"), "new password");
    await fireEvent.press(screen.getByRole("button", { name: "Update password and sign in" }));
    expect(mockSignIn.resetPasswordEmailCode.submitPassword).toHaveBeenCalledWith({
      password: "new password",
      signOutOfOtherSessions: true,
    });
    expect(mockSignIn.finalize).toHaveBeenCalledTimes(1);
  });
  test.each([0, 1])(
    "leaving for tab %s clears password and error but preserves email",
    async (tab) => {
      mockSignIn.password.mockResolvedValueOnce({
        error: { code: "form_password_incorrect", message: "Wrong password" },
      });
      await render(<SignInView />);
      await fireEvent.press(screen.getByRole("button", { name: "Sign in with a password" }));
      await fireEvent.changeText(screen.getByLabelText("Email address"), "skater@example.com");
      await fireEvent.changeText(screen.getByLabelText("Password"), "wrong");
      await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
      expect(screen.getByRole("alert")).toBeOnTheScreen();
      await switchTab(tab);
      await switchTab(2);
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeOnTheScreen();
      expect(screen.getByLabelText("Email address")).toHaveProp("value", "skater@example.com");
      await fireEvent.press(screen.getByRole("button", { name: "Sign in with a password" }));
      expect(screen.getByLabelText("Password")).toHaveProp("value", "");
    },
  );

  test("visiting Mail preserves a code, but switching tabs discards it", async () => {
    const appStateListener = jest.spyOn(AppState, "addEventListener");
    await render(<SignInView />);
    await fireEvent.changeText(screen.getByLabelText("Email address"), "skater@example.com");
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    await fireEvent.changeText(screen.getByLabelText("Verification code"), "123456");
    await act(() => {
      for (const [event, listener] of appStateListener.mock.calls) {
        if (event === "change") {
          listener("background");
          listener("active");
        }
      }
    });
    expect(screen.getByLabelText("Verification code")).toHaveProp("value", "123456");
    expect(mockSignIn.reset).not.toHaveBeenCalled();
    await switchTab(0);
    await switchTab(2);
    expect(mockSignIn.reset).toHaveBeenCalledTimes(1);
    expect(mockSignUp.reset).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText("Verification code")).toHaveProp("value", "");
    appStateListener.mockRestore();
  });

  test("a late code response cannot restore a flow abandoned by switching tabs", async () => {
    let finishSend!: (result: { error: null }) => void;
    mockSignIn.emailCode.sendCode.mockReturnValueOnce(
      new Promise((resolve) => {
        finishSend = resolve;
      }),
    );
    await render(<SignInView />);
    await fireEvent.changeText(screen.getByLabelText("Email address"), "skater@example.com");
    await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
    await switchTab(0);
    await switchTab(2);
    expect(screen.getByLabelText("Email address")).toHaveProp("value", "skater@example.com");
    expect(mockSignIn.reset).not.toHaveBeenCalled();
    await act(() => finishSend({ error: null }));
    expect(screen.queryByLabelText("Verification code")).toBeNull();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    expect(mockSignIn.reset).toHaveBeenCalledTimes(1);
  });
});
