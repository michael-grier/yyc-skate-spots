import { PermissionStatus, type PermissionResponse } from "expo";
import { Alert, Linking } from "react-native";

import { ensurePermission } from "./permissions";

const response = (status: PermissionStatus, canAskAgain = false): PermissionResponse => ({
  status,
  granted: status === PermissionStatus.GRANTED,
  canAskAgain,
  expires: "never",
});
const copy = { title: "Photo access is off", message: "Allow access in Settings." };
const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);

beforeEach(() => jest.clearAllMocks());

test("resolves without prompting when access is already granted", async () => {
  const request = jest.fn();
  expect(
    await ensurePermission(async () => response(PermissionStatus.GRANTED), request, copy),
  ).toBe(true);
  expect(request).not.toHaveBeenCalled();
});

test("offers Settings when iOS no longer shows its prompt", async () => {
  const denied = async () => response(PermissionStatus.DENIED);
  expect(await ensurePermission(denied, denied, copy)).toBe(false);
  expect(alert).toHaveBeenCalledWith(copy.title, copy.message, expect.any(Array));
  const buttons = alert.mock.calls[0]?.[2];
  expect(buttons?.map((button) => button.text)).toEqual(["Not now", "Open Settings"]);
  buttons?.[1]?.onPress?.();
  expect(openSettings).toHaveBeenCalled();
});

test("adds no dialog after a decline on the system prompt", async () => {
  expect(
    await ensurePermission(
      async () => response(PermissionStatus.UNDETERMINED, true),
      async () => response(PermissionStatus.DENIED),
      copy,
    ),
  ).toBe(false);
  expect(alert).not.toHaveBeenCalled();
});
