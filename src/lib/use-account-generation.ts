import { useAuth } from "@clerk/expo";
import { useState } from "react";

/**
 * Increments when a different account signs in. Signing out, or signing back in as the same
 * account, keeps the value, so state from a signed-out session carries into sign-in. Use it as
 * a React key to give each account a fresh screen.
 */
export function useAccountGeneration() {
  const { userId } = useAuth();
  const [last, setLast] = useState<{ userId: string | null; generation: number }>({
    userId: null,
    generation: 0,
  });
  if (userId && userId !== last.userId) {
    // Updating during render makes React re-render before committing, so the previous account's
    // screen never renders under the new account.
    setLast({ userId, generation: last.userId === null ? 0 : last.generation + 1 });
  }
  return last.generation;
}
