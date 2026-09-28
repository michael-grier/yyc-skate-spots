import { type PermissionResponse, PermissionStatus } from "expo";
import { Alert, Linking } from "react-native";

type AccessOffCopy = { title: string; message: string };

/**
 * Requests a permission and resolves whether it is granted. iOS shows its prompt only once, then
 * denies requests silently, so explain how to turn access on in Settings. A decline on the system
 * prompt just now needs no follow-up dialog.
 */
export async function ensurePermission(
  get: () => Promise<PermissionResponse>,
  request: () => Promise<PermissionResponse>,
  accessOff: AccessOffCopy,
) {
  const before = await get();
  if (before.granted) return true;
  const after = await request();
  if (!after.granted && before.status !== PermissionStatus.UNDETERMINED) {
    Alert.alert(accessOff.title, accessOff.message, [
      { text: "Not now", style: "cancel" },
      { text: "Open Settings", onPress: () => void Linking.openSettings() },
    ]);
  }
  return after.granted;
}
