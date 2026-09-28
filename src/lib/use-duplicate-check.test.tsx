import { act, renderHook } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";

import { useDuplicateCheck } from "./use-duplicate-check";

const mockPush = jest.fn();
const pin = { latitude: 51.0447, longitude: -114.0719 };
const mockPublished = [{ _id: "existing", name: "Plaza Ledge", ...pin }];
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("convex/react", () => {
  const { getFunctionName } = jest.requireActual<typeof import("convex/server")>("convex/server");
  return {
    useQuery: (reference: Parameters<typeof getFunctionName>[0]) =>
      getFunctionName(reference) === "spots:list" ? mockPublished : [],
  };
});
const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

beforeEach(() => jest.clearAllMocks());

function press(label: RegExp) {
  const buttons: AlertButton[] = alert.mock.calls.at(-1)?.[2] ?? [];
  const button = buttons.find((candidate) => label.test(candidate.text ?? ""));
  if (!button?.onPress) throw new Error(`Missing ${label} button`);
  button.onPress();
}

test("links each nearby spot and stops asking once the pin is confirmed", async () => {
  const { result } = await renderHook(() => useDuplicateCheck());

  let viewing!: Promise<boolean>;
  await act(async () => {
    viewing = result.current(pin);
  });
  press(/^View Plaza Ledge \(0 m\)$/);
  await expect(viewing).resolves.toBe(false);
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/spot/[id]", params: { id: "existing" } });

  let confirming!: Promise<boolean>;
  await act(async () => {
    confirming = result.current(pin);
  });
  press(/different spot/);
  await expect(confirming).resolves.toBe(true);

  await expect(result.current(pin)).resolves.toBe(true);
  expect(alert).toHaveBeenCalledTimes(2);
});

test("continues without asking when nothing is nearby", async () => {
  const { result } = await renderHook(() => useDuplicateCheck());
  await expect(result.current({ latitude: 51.1, longitude: -114.2 })).resolves.toBe(true);
  expect(alert).not.toHaveBeenCalled();
});
