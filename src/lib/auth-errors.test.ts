import { describe, expect, test } from "vitest";

import { describeAuthError, hasAuthErrorCode } from "./auth-errors";

describe("describeAuthError", () => {
  test("is null when there is no error", () => {
    expect(describeAuthError(null)).toBeNull();
    expect(describeAuthError(undefined)).toBeNull();
  });

  test("prefers the friendly message for known codes", () => {
    expect(describeAuthError({ code: "form_code_incorrect", message: "is incorrect" })).toBe(
      "That code isn't right. Check it and try again.",
    );
  });

  test("reads actionable errors nested in a Clerk API response error", () => {
    const error = {
      code: "api_response_error",
      message: "Couldn't find your account.",
      errors: [
        {
          code: "form_identifier_not_found",
          message: "Couldn't find your account.",
        },
      ],
    };

    expect(hasAuthErrorCode(error, "form_identifier_not_found")).toBe(true);
    expect(describeAuthError(error)).toBe("Couldn't find your account.");
  });

  test("falls back to Clerk's long message, then message", () => {
    expect(
      describeAuthError({ code: "unknown_code", message: "short", longMessage: "A longer one." }),
    ).toBe("A longer one.");
    expect(describeAuthError({ code: "unknown_code", message: "short" })).toBe("short");
  });

  test("never returns an empty string", () => {
    expect(describeAuthError({ message: "" })).toBe("Something went wrong. Try again.");
  });
});
