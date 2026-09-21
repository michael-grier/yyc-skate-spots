import { act, renderHook } from "@testing-library/react-native";

import { useEmailCodeAuth } from "./use-email-code-auth";

const mockSignIn = {
  status: "complete",
  emailCode: { sendCode: jest.fn(), verifyCode: jest.fn() },
  password: jest.fn(),
  create: jest.fn(),
  reset: jest.fn(),
  resetPasswordEmailCode: { sendCode: jest.fn(), verifyCode: jest.fn(), submitPassword: jest.fn() },
  finalize: jest.fn(),
};
const mockSignUp = {
  reset: jest.fn(),
  create: jest.fn(),
  verifications: { sendEmailCode: jest.fn(), verifyEmailCode: jest.fn() },
  finalize: jest.fn(),
};

jest.mock("@clerk/expo", () => ({
  useSignIn: () => ({ signIn: mockSignIn }),
  useSignUp: () => ({ signUp: mockSignUp }),
}));

const ok = { error: null };
const err = (code: string, message = code) => ({ error: { code, message } });
const apiErr = (code: string, message = code) => ({
  error: {
    code: "api_response_error",
    message,
    errors: [{ code, message }],
  },
});

const ALL_MOCKS = [
  mockSignIn.emailCode.sendCode,
  mockSignIn.emailCode.verifyCode,
  mockSignIn.password,
  mockSignIn.create,
  mockSignIn.reset,
  mockSignIn.resetPasswordEmailCode.sendCode,
  mockSignIn.resetPasswordEmailCode.verifyCode,
  mockSignIn.resetPasswordEmailCode.submitPassword,
  mockSignUp.reset,
  mockSignIn.finalize,
  mockSignUp.create,
  mockSignUp.verifications.sendEmailCode,
  mockSignUp.verifications.verifyEmailCode,
  mockSignUp.finalize,
];

beforeEach(() => {
  jest.clearAllMocks();
  mockSignIn.status = "complete";
  for (const fn of ALL_MOCKS) {
    fn.mockResolvedValue(ok);
  }
});

describe("useEmailCodeAuth", () => {
  test("existing account: sends the sign-in code and verifies through finalize", async () => {
    const { result } = await renderHook(() => useEmailCodeAuth());

    await act(() => result.current.sendCode("  skater@example.com "));
    expect(mockSignIn.emailCode.sendCode).toHaveBeenCalledWith({
      emailAddress: "skater@example.com",
    });
    expect(mockSignUp.create).not.toHaveBeenCalled();
    expect(result.current.step).toEqual({
      kind: "code",
      emailAddress: "skater@example.com",
      mode: "signIn",
    });

    await act(() => result.current.verifyCode(" 123456 "));
    expect(mockSignIn.emailCode.verifyCode).toHaveBeenCalledWith({ code: "123456" });
    expect(mockSignIn.finalize).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  test("unknown address falls through to a sign-up with the same email", async () => {
    mockSignIn.emailCode.sendCode.mockResolvedValue(apiErr("form_identifier_not_found"));
    const { result } = await renderHook(() => useEmailCodeAuth());

    await act(() => result.current.sendCode("new@example.com"));
    expect(mockSignUp.create).toHaveBeenCalledWith({ emailAddress: "new@example.com" });
    expect(mockSignUp.verifications.sendEmailCode).toHaveBeenCalledTimes(1);
    expect(result.current.step).toMatchObject({ kind: "code", mode: "signUp" });

    await act(() => result.current.verifyCode("654321"));
    expect(mockSignUp.verifications.verifyEmailCode).toHaveBeenCalledWith({ code: "654321" });
    expect(mockSignUp.finalize).toHaveBeenCalledTimes(1);
  });

  test("other send errors surface a friendly message and stay on the email step", async () => {
    mockSignIn.emailCode.sendCode.mockResolvedValue(err("too_many_requests"));
    const { result } = await renderHook(() => useEmailCodeAuth());

    await act(() => result.current.sendCode("skater@example.com"));
    expect(result.current.step).toEqual({ kind: "email" });
    expect(result.current.error).toBe("Too many attempts. Wait a minute and try again.");
    expect(mockSignUp.create).not.toHaveBeenCalled();
  });

  test("a wrong code surfaces its message and does not finalize", async () => {
    mockSignIn.emailCode.verifyCode.mockResolvedValue(err("form_code_incorrect"));
    const { result } = await renderHook(() => useEmailCodeAuth());

    await act(() => result.current.sendCode("skater@example.com"));
    await act(() => result.current.verifyCode("000000"));
    expect(result.current.error).toBe("That code isn't right. Check it and try again.");
    expect(mockSignIn.finalize).not.toHaveBeenCalled();
  });

  test("signs an existing account in with its password", async () => {
    const { result } = await renderHook(() => useEmailCodeAuth());

    await act(() => result.current.signInWithPassword("  reviewer@example.com ", "not-trimmed "));

    expect(mockSignIn.password).toHaveBeenCalledWith({
      emailAddress: "reviewer@example.com",
      password: "not-trimmed ",
    });
    expect(mockSignIn.finalize).toHaveBeenCalledTimes(1);
    expect(mockSignUp.create).not.toHaveBeenCalled();
  });

  test("a wrong password surfaces a neutral message and does not finalize", async () => {
    mockSignIn.password.mockResolvedValue(err("form_password_incorrect"));
    const { result } = await renderHook(() => useEmailCodeAuth());

    await act(() => result.current.signInWithPassword("reviewer@example.com", "wrong"));

    expect(result.current.error).toBe("That email or password isn't right.");
    expect(mockSignIn.finalize).not.toHaveBeenCalled();
  });

  test.each(["needs_client_trust", "needs_second_factor"])(
    "does not finalize a password attempt with status %s",
    async (status) => {
      mockSignIn.status = status;
      const { result } = await renderHook(() => useEmailCodeAuth());

      await act(() => result.current.signInWithPassword("reviewer@example.com", "password"));

      expect(result.current.error).toBe(
        "This account needs another verification step. Use an email code instead.",
      );
      expect(mockSignIn.finalize).not.toHaveBeenCalled();
    },
  );

  test("network failures release the form for a retry", async () => {
    mockSignIn.password.mockRejectedValueOnce(new Error("Connection interrupted"));
    const { result } = await renderHook(() => useEmailCodeAuth());
    await act(() => result.current.signInWithPassword("skater@example.com", "password"));
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBe("Connection interrupted");
    await act(() => result.current.signInWithPassword("skater@example.com", "password"));
    expect(result.current.error).toBeNull();
    expect(mockSignIn.finalize).toHaveBeenCalledTimes(1);
  });

  test("password reset verifies the code before accepting a new password", async () => {
    const { result } = await renderHook(() => useEmailCodeAuth());
    await act(() => result.current.submitNewPassword("too early"));
    expect(mockSignIn.resetPasswordEmailCode.submitPassword).not.toHaveBeenCalled();
    await act(() => result.current.sendPasswordResetCode(" skater@example.com "));
    expect(mockSignIn.create).toHaveBeenCalledWith({ identifier: "skater@example.com" });
    expect(result.current.step).toMatchObject({ kind: "code", mode: "passwordReset" });
    mockSignIn.resetPasswordEmailCode.verifyCode.mockResolvedValueOnce(err("form_code_incorrect"));
    await act(() => result.current.verifyCode("000000"));
    expect(result.current.step.kind).toBe("code");
    expect(mockSignIn.finalize).not.toHaveBeenCalled();
    await act(() => result.current.resendCode());
    expect(mockSignIn.resetPasswordEmailCode.sendCode).toHaveBeenCalledTimes(2);
    expect(mockSignIn.emailCode.sendCode).not.toHaveBeenCalled();
    await act(() => result.current.verifyCode(" 123456 "));
    expect(mockSignIn.resetPasswordEmailCode.verifyCode).toHaveBeenLastCalledWith({
      code: "123456",
    });
    expect(result.current.step.kind).toBe("newPassword");
    mockSignIn.resetPasswordEmailCode.submitPassword.mockResolvedValueOnce(
      err("form_password_pwned", "Choose a stronger password."),
    );
    await act(() => result.current.submitNewPassword("weak"));
    expect(result.current.error).toBe("Choose a stronger password.");
    expect(mockSignIn.finalize).not.toHaveBeenCalled();
    await act(() => result.current.submitNewPassword("new password "));
    expect(mockSignIn.resetPasswordEmailCode.submitPassword).toHaveBeenLastCalledWith({
      password: "new password ",
      signOutOfOtherSessions: true,
    });
    expect(mockSignIn.finalize).toHaveBeenCalledTimes(1);
  });

  test("a reset requiring another factor never activates a session", async () => {
    const { result } = await renderHook(() => useEmailCodeAuth());
    await act(() => result.current.sendPasswordResetCode("skater@example.com"));
    await act(() => result.current.verifyCode("123456"));
    mockSignIn.status = "needs_second_factor";
    await act(() => result.current.submitNewPassword("new password"));
    expect(mockSignIn.finalize).not.toHaveBeenCalled();
    expect(result.current.error).toContain("Go back to sign in with an email code");
  });

  test("reset returns to the email step and clears the error", async () => {
    mockSignIn.emailCode.sendCode.mockResolvedValue(err("too_many_requests"));
    const { result } = await renderHook(() => useEmailCodeAuth());
    await act(() => result.current.sendCode("skater@example.com"));

    await act(() => result.current.reset());
    expect(mockSignIn.reset).toHaveBeenCalledTimes(1);
    expect(mockSignUp.reset).toHaveBeenCalledTimes(1);
    expect(result.current.step).toEqual({ kind: "email" });
    expect(result.current.error).toBeNull();
  });

  test.each([
    ["signIn", "returned"],
    ["signUp", "returned"],
    ["signIn", "rejected"],
    ["signUp", "rejected"],
  ] as const)("reset reports a %s %s failure and permits a retry", async (attempt, failure) => {
    const { result } = await renderHook(() => useEmailCodeAuth());
    await act(() => result.current.sendCode("skater@example.com"));
    const reset = attempt === "signIn" ? mockSignIn.reset : mockSignUp.reset;
    if (failure === "returned") reset.mockResolvedValueOnce(err("reset_failed", "Reset failed"));
    else reset.mockRejectedValueOnce(new Error("Reset failed"));

    await act(async () => expect(await result.current.reset()).toBe(false));
    expect(result.current.step.kind).toBe("code");
    expect(result.current.error).toBe("Reset failed");
    expect(result.current.busy).toBe(false);

    await act(async () => expect(await result.current.reset()).toBe(true));
    expect(result.current.step.kind).toBe("email");
    expect(result.current.error).toBeNull();
  });
});
