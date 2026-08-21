import { describe, expect, test } from "vitest";

import { describeAuthError } from "./auth-errors";

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
