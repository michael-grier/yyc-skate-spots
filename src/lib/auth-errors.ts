type ClerkLikeError = { code?: string; message: string; longMessage?: string };

/** Clerk error code returned when a sign-in identifier has no account. */
export const IDENTIFIER_NOT_FOUND = "form_identifier_not_found";

// Clerk's messages are accurate but read like API docs; these are the ones
// users actually hit in the email-code flow.
const FRIENDLY_MESSAGES: Record<string, string> = {
  form_param_format_invalid: "That doesn't look like an email address.",
  form_code_incorrect: "That code isn't right. Check it and try again.",
  verification_expired: "That code has expired. Send a new one.",
  verification_failed: "Too many wrong codes. Send a new one.",
  too_many_requests: "Too many attempts. Wait a minute and try again.",
  session_exists: "You're already signed in.",
};

/** Human-readable message for a Clerk error; null when there is none. */
export function describeAuthError(error: ClerkLikeError | null | undefined): string | null {
  if (!error) {
    return null;
  }
  return (
    (error.code && FRIENDLY_MESSAGES[error.code]) ||
    error.longMessage ||
    error.message ||
    "Something went wrong. Try again."
  );
}
