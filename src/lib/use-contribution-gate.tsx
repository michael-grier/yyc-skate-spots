import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import { StandardsAcceptanceSheet } from "@/components/standards-acceptance-sheet";

type GatedAction = () => Promise<void>;

/**
 * Runs an action the server guards with requireCanContribute. An owner who
 * hasn't accepted the current standards is asked to first, and the action
 * then runs. Production redacts the server's reason, so this reads the
 * viewer's status up front rather than parsing the failure.
 */
export function useContributionGate() {
  const router = useRouter();
  const viewer = useQuery(api.moderation.viewer);
  // Native alert buttons keep the closure from when the alert opened; read the latest status.
  const latestViewer = useRef(viewer);
  useEffect(() => {
    latestViewer.current = viewer;
  }, [viewer]);
  const acknowledgeStandards = useMutation(api.moderation.acknowledgeStandards);
  const [pending, setPending] = useState<GatedAction | null>(null);
  const [accepting, setAccepting] = useState(false);

  function runGated(action: GatedAction) {
    const status = latestViewer.current;
    if (status?.isBanned) {
      Alert.alert(
        "Changing spots is unavailable",
        "Your contribution access was removed after repeated spots did not meet the standards.",
      );
      return;
    }
    // While the viewer loads, let the server decide rather than block the tap.
    if (status && !status.hasAcknowledgedStandards) {
      setPending(() => action);
      return;
    }
    void action();
  }

  async function acceptAndRun() {
    if (!pending) return;
    setAccepting(true);
    try {
      await acknowledgeStandards({});
    } catch {
      Alert.alert("Couldn't accept the standards", "Try again.");
      setAccepting(false);
      return;
    }
    setAccepting(false);
    setPending(null);
    await pending();
  }

  const standardsSheet = (
    <StandardsAcceptanceSheet
      visible={pending !== null}
      submitting={accepting}
      onClose={() => setPending(null)}
      onAgree={() => void acceptAndRun()}
      onReadFullStandards={() => {
        setPending(null);
        router.push("/standards");
      }}
    />
  );

  return { runGated, standardsSheet, isBanned: viewer?.isBanned === true };
}
