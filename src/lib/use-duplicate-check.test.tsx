import { renderHook, waitFor } from "@testing-library/react-native";
import { Alert, type AlertButton } from "react-native";

import { useDuplicateCheck } from "./use-duplicate-check";

const mockPush = jest.fn();
const pin = { latitude: 51.0447, longitude: -114.0719 };
const mockPublished = [{ _id: "existing", name: "Plaza Ledge", ...pin }];
let mockQueryError: Error | null = null;
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("convex/react", () => {
  const { getFunctionName } = jest.requireActual<typeof import("convex/server")>("convex/server");
  return {
    useConvex: () => ({
      query: async (reference: Parameters<typeof getFunctionName>[0]) => {
        if (mockQueryError) throw mockQueryError;
        return getFunctionName(reference) === "spots:list" ? mockPublished : [];
      },
    }),
  };
});
const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryError = null;
});

async function press(label: RegExp, alertCount: number) {
  await waitFor(() => expect(alert).toHaveBeenCalledTimes(alertCount));
  const buttons: AlertButton[] = alert.mock.calls.at(-1)?.[2] ?? [];
  const button = buttons.find((candidate) => label.test(candidate.text ?? ""));
  if (!button?.onPress) throw new Error(`Missing ${label} button`);
  button.onPress();
}

test("links each nearby spot and stops asking once the pin is confirmed", async () => {
  const { result } = await renderHook(() => useDuplicateCheck());

  const viewing = result.current(pin);
  await press(/^View Plaza Ledge$/, 1);
  await expect(viewing).resolves.toBe(false);
  expect(alert.mock.calls[0]?.[1]).toContain("Plaza Ledge (0 m)");
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/spot/[id]", params: { id: "existing" } });

  const confirming = result.current(pin);
  await press(/different spot/, 2);
  await expect(confirming).resolves.toBe(true);

  await expect(result.current(pin)).resolves.toBe(true);
  expect(alert).toHaveBeenCalledTimes(2);
});

test("stays on the step when the check cannot run", async () => {
  const { result } = await renderHook(() => useDuplicateCheck());
  mockQueryError = new Error("server error");
  await expect(result.current(pin)).resolves.toBe(false);
  expect(alert).toHaveBeenCalledWith("Couldn't check for nearby spots", expect.any(String));
});

test("continues without asking when nothing is nearby", async () => {
  const { result } = await renderHook(() => useDuplicateCheck());
  await expect(result.current({ latitude: 51.1, longitude: -114.2 })).resolves.toBe(true);
  expect(alert).not.toHaveBeenCalled();
});
