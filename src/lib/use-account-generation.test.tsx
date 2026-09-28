import { renderHook } from "@testing-library/react-native";

import { useAccountGeneration } from "./use-account-generation";

let mockUserId: string | null = null;
jest.mock("@clerk/expo", () => ({ useAuth: () => ({ userId: mockUserId }) }));

test("changes only when a different account signs in", async () => {
  mockUserId = null;
  const { result, rerender } = await renderHook(() => useAccountGeneration());
  const signIn = async (userId: string | null) => {
    mockUserId = userId;
    await rerender({});
  };

  await signIn("user_a");
  expect(result.current).toBe(0);
  await signIn(null);
  await signIn("user_a");
  expect(result.current).toBe(0);
  await signIn(null);
  await signIn("user_b");
  expect(result.current).toBe(1);
});
