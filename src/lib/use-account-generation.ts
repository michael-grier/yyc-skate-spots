import { useAuth } from "@clerk/expo";
import { useEffect, useRef, useState } from "react";

/**
 * Increments when a different account signs in. Signing out, or signing back in as the same
 * account, keeps the value, so state from a signed-out session carries into sign-in. Use it as
 * a React key to give each account a fresh screen.
 */
export function useAccountGeneration() {
  const { userId } = useAuth();
  const lastUserId = useRef<string | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!userId) return;
    if (lastUserId.current !== null && lastUserId.current !== userId) {
      setGeneration((current) => current + 1);
    }
    lastUserId.current = userId;
  }, [userId]);

  return generation;
}
