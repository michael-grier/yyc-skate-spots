import { useSignIn, useSignUp } from "@clerk/expo";
import { useState } from "react";

import { IDENTIFIER_NOT_FOUND, describeAuthError, hasAuthErrorCode } from "@/lib/auth-errors";

export type EmailCodeStep =
  | { kind: "email" }
  | { kind: "code"; emailAddress: string; mode: "signIn" | "signUp" };

/**
 * Passwordless email-code auth that signs existing users in and signs new
 * ones up from the same two fields. Completing either path activates the
 * Clerk session, which flips useAuth().isSignedIn for the rest of the app —
 * authorization still happens server-side in Convex on every write.
 */
export function useEmailCodeAuth() {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [step, setStep] = useState<EmailCodeStep>({ kind: "email" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  }

  async function sendCode(input: string) {
    const emailAddress = input.trim();
    await run(async () => {
      const { error: signInError } = await signIn.emailCode.sendCode({ emailAddress });
      if (!signInError) {
        setStep({ kind: "code", emailAddress, mode: "signIn" });
        return;
      }
      if (!hasAuthErrorCode(signInError, IDENTIFIER_NOT_FOUND)) {
        setError(describeAuthError(signInError));
        return;
      }
      // No account for this address yet: start a sign-up with it instead.
      const { error: createError } = await signUp.create({ emailAddress });
      if (createError) {
        setError(describeAuthError(createError));
        return;
      }
      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) {
        setError(describeAuthError(sendError));
        return;
      }
      setStep({ kind: "code", emailAddress, mode: "signUp" });
    });
  }

  async function verifyCode(code: string) {
    if (step.kind !== "code") {
      return;
    }
    await run(async () => {
      const { error: verifyError } =
        step.mode === "signIn"
          ? await signIn.emailCode.verifyCode({ code: code.trim() })
          : await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (verifyError) {
        setError(describeAuthError(verifyError));
        return;
      }
      const { error: finalizeError } =
        step.mode === "signIn" ? await signIn.finalize() : await signUp.finalize();
      if (finalizeError) {
        setError(describeAuthError(finalizeError));
      }
    });
  }

  async function resendCode() {
    if (step.kind !== "code") {
      return;
    }
    await run(async () => {
      const { error: sendError } =
        step.mode === "signIn"
          ? await signIn.emailCode.sendCode({ emailAddress: step.emailAddress })
          : await signUp.verifications.sendEmailCode();
      if (sendError) {
        setError(describeAuthError(sendError));
      }
    });
  }

  /** Back to the email field, e.g. to correct a typo. */
  function reset() {
    setStep({ kind: "email" });
    setError(null);
  }

  return { step, error, busy, sendCode, verifyCode, resendCode, reset };
}
