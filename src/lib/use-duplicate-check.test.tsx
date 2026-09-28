import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { createRef, type RefObject, useImperativeHandle } from "react";
import { Alert } from "react-native";

import type { LatLng } from "./geo";
import { useDuplicateCheck } from "./use-duplicate-check";

const mockPush = jest.fn();
const pin = { latitude: 51.0447, longitude: -114.0719 };
const mockPublished = [{ _id: "existing", name: "Winter Club Hubba & Gap", ...pin }];
let mockQueryError: Error | null = null;
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
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

type Check = (location: LatLng) => Promise<boolean>;
const checkRef = createRef<Check>();
function Harness({ check }: { check: RefObject<Check | null> }) {
  const { confirmNotDuplicate, duplicateSheet } = useDuplicateCheck();
  useImperativeHandle(check, () => confirmNotDuplicate);
  return duplicateSheet;
}

/** Starts a check and waits for its sheet to render. Wrapped so awaiting does not await the answer. */
async function ask(location: LatLng) {
  let answer!: Promise<boolean>;
  await act(async () => {
    answer = checkRef.current?.(location) ?? Promise.reject(new Error("Harness not rendered"));
  });
  return { answer };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryError = null;
});

test("links each nearby spot and stops asking once the pin is confirmed unique", async () => {
  await render(<Harness check={checkRef} />);

  const viewing = (await ask(pin)).answer;
  expect(screen.getByText("Potential duplicate spot detected")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("link", { name: /^View Winter Club Hubba & Gap/ }));
  await expect(viewing).resolves.toBe(false);
  expect(mockPush).toHaveBeenCalledWith({ pathname: "/spot/[id]", params: { id: "existing" } });

  const confirming = (await ask(pin)).answer;
  await fireEvent.press(screen.getByRole("button", { name: "My spot is unique" }));
  await expect(confirming).resolves.toBe(true);

  await expect((await ask(pin)).answer).resolves.toBe(true);
});

test("stays on the step when the check cannot run", async () => {
  await render(<Harness check={checkRef} />);
  mockQueryError = new Error("server error");
  await expect((await ask(pin)).answer).resolves.toBe(false);
  expect(alert).toHaveBeenCalledWith("Couldn't check for nearby spots", expect.any(String));
});

test("continues without asking when nothing is nearby", async () => {
  await render(<Harness check={checkRef} />);
  await expect((await ask({ latitude: 51.1, longitude: -114.2 })).answer).resolves.toBe(true);
  expect(screen.queryByText("Potential duplicate spot detected")).toBeNull();
});
