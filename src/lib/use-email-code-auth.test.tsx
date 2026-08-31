import { act, renderHook } from "@testing-library/react-native";

import { useEmailCodeAuth } from "./use-email-code-auth";

const mockSignIn = {
  emailCode: { sendCode: jest.fn(), verifyCode: jest.fn() },
  finalize: jest.fn(),
};
const mockSignUp = {
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
  mockSignIn.finalize,
  mockSignUp.create,
  mockSignUp.verifications.sendEmailCode,
  mockSignUp.verifications.verifyEmailCode,
  mockSignUp.finalize,
];

beforeEach(() => {
  jest.clearAllMocks();
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

  test("reset returns to the email step and clears the error", async () => {
    mockSignIn.emailCode.sendCode.mockResolvedValue(err("too_many_requests"));
    const { result } = await renderHook(() => useEmailCodeAuth());
    await act(() => result.current.sendCode("skater@example.com"));

    await act(() => {
      result.current.reset();
    });
    expect(result.current.step).toEqual({ kind: "email" });
    expect(result.current.error).toBeNull();
  });
});
