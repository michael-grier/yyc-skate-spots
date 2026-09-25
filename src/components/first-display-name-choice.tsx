import { useClerk, useUser } from "@clerk/expo";
import { api } from "@convex/_generated/api";
import { publicDisplayName } from "@convex/displayNames";
import { useQuery } from "convex/react";

import { DisplayNameSheet } from "@/components/display-name-sheet";

/** Mounted above every route so a sign-in that resumes elsewhere, like a report, still asks. */
export function FirstDisplayNameChoice() {
  const profile = useQuery(api.profiles.me);
  const { user } = useUser();
  const { signOut } = useClerk();
  if (!profile || profile.hasChosenName) return null;
  return (
    <DisplayNameSheet
      // Production tokens omit provider names, so suggest the Apple or Google name from Clerk.
      initialName={publicDisplayName(user?.fullName) ?? profile.displayName}
      anonymousName={profile.anonymousName}
      // Saving creates the profile row, which unmounts this sheet reactively.
      onClose={() => undefined}
      onSignOut={() => void signOut()}
    />
  );
}
