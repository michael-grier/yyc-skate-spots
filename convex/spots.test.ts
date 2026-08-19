/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const SPOT = {
  name: "Test Ledge",
  type: "ledge" as const,
  bustFactor: "high" as const,
  latitude: 51.0447,
  longitude: -114.0719,
  photoIds: [] as Id<"_storage">[],
};

describe("spots authz", () => {
  test("browsing is public but writing requires sign-in", async () => {
    const t = convexTest(schema, modules);
    await expect(t.mutation(api.spots.create, SPOT)).rejects.toThrow(/signed in/);
    expect(await t.query(api.spots.list, {})).toEqual([]);
  });

  test("creator can update and delete their spot", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice", name: "Alice" });

    const id = await asAlice.mutation(api.spots.create, SPOT);
    await asAlice.mutation(api.spots.update, { ...SPOT, id, bustFactor: "low" });
    const updated = await t.query(api.spots.get, { id });
    expect(updated?.bustFactor).toBe("low");
    expect(updated?.createdByName).toBe("Alice");

    await asAlice.mutation(api.spots.remove, { id });
    expect(await t.query(api.spots.get, { id })).toBeNull();
  });

  test("a different user cannot update or delete someone else's spot", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });
    const asBob = t.withIdentity({ subject: "bob" });

    const id = await asAlice.mutation(api.spots.create, SPOT);
    await expect(asBob.mutation(api.spots.update, { ...SPOT, id, name: "Stolen" })).rejects.toThrow(
      /Only the person/,
    );
    await expect(asBob.mutation(api.spots.remove, { id })).rejects.toThrow(/Only the person/);

    // Untouched after both rejected writes.
    const spot = await t.query(api.spots.get, { id });
    expect(spot?.name).toBe("Test Ledge");
  });

  test("field limits are enforced", async () => {
    const t = convexTest(schema, modules);
    const asAlice = t.withIdentity({ subject: "alice" });

    await expect(asAlice.mutation(api.spots.create, { ...SPOT, name: "  " })).rejects.toThrow(
      /Name/,
    );
    await expect(
      asAlice.mutation(api.spots.create, { ...SPOT, notes: "x".repeat(2001) }),
    ).rejects.toThrow(/Notes/);
  });
});
