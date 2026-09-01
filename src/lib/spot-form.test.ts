import { describe, expect, test } from "vitest";

import {
  EMPTY_SPOT_FORM,
  firstInvalidStep,
  type SpotFormValues,
  spotToFormValues,
  validateSpotForm,
  validateSpotStep,
} from "./spot-form";

const VALID: SpotFormValues = {
  ...EMPTY_SPOT_FORM,
  name: "  Harmony Park ",
  types: ["ledge", "stairs"],
  bustFactor: "medium",
  latitude: 51.049144,
  longitude: -114.063528,
};

describe("validateSpotForm", () => {
  test("trims the name and drops empty optional fields from the payload", () => {
    const result = validateSpotForm(VALID);
    expect(result).toEqual({
      ok: true,
      payload: {
        name: "Harmony Park",
        types: ["ledge", "stairs"],
        bustFactor: "medium",
        latitude: 51.049144,
        longitude: -114.063528,
      },
    });
  });

  test("keeps surface and notes when provided", () => {
    const result = validateSpotForm({ ...VALID, surface: "rough", notes: " Go early. " });
    expect(result.ok && result.payload).toMatchObject({ surface: "rough", notes: "Go early." });
  });

  test("reports each missing required field once, by field", () => {
    const result = validateSpotForm(EMPTY_SPOT_FORM);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual({
        name: "Give the spot a name.",
        types: "Pick at least one type.",
        bustFactor: "Pick a bust factor.",
        location: "Set the spot location.",
      });
    }
  });

  test("enforces length caps and the photo limit", () => {
    const photo = { key: "k", uri: "file://x", width: 1, height: 1 };
    const result = validateSpotForm({
      ...VALID,
      name: "x".repeat(81),
      notes: "n".repeat(2001),
      photos: Array.from({ length: 7 }, (_, i) => ({ ...photo, key: `k${i}` })),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.name).toMatch(/80/);
      expect(result.errors.notes).toMatch(/2000/);
      expect(result.errors.photos).toMatch(/6/);
    }
  });
});

describe("spotToFormValues", () => {
  test("pairs stored photo ids with their urls", () => {
    const values = spotToFormValues({
      name: "Chinook",
      types: ["ledge"],
      bustFactor: "high",
      latitude: 50.99,
      longitude: -114.07,
      photoIds: ["a" as never, "b" as never],
      photoUrls: ["https://x/a", "https://x/b"],
    });
    expect(values.surface).toBeNull();
    expect(values.notes).toBe("");
    expect(values.photos.map((p) => [p.storageId, p.uri])).toEqual([
      ["a", "https://x/a"],
      ["b", "https://x/b"],
    ]);
  });
});

describe("validateSpotStep", () => {
  test("reports only the fields the step owns, so Next never flags work not yet reached", () => {
    expect(validateSpotStep(EMPTY_SPOT_FORM, "basics")).toEqual({
      name: "Give the spot a name.",
      types: "Pick at least one type.",
    });
    expect(validateSpotStep(EMPTY_SPOT_FORM, "place")).toEqual({
      location: "Set the spot location.",
    });
    expect(validateSpotStep(EMPTY_SPOT_FORM, "details")).toEqual({
      bustFactor: "Pick a bust factor.",
    });
  });

  test("passes a step whose own fields are filled in even when later steps are empty", () => {
    const basicsOnly = { ...EMPTY_SPOT_FORM, name: "Harmony Park", types: ["ledge" as const] };
    expect(validateSpotStep(basicsOnly, "basics")).toEqual({});
    expect(validateSpotStep(basicsOnly, "place")).toEqual({ location: "Set the spot location." });
  });
});

describe("firstInvalidStep", () => {
  test("points at the earliest step holding an error", () => {
    expect(firstInvalidStep({ name: "x", bustFactor: "y" })).toBe("basics");
    expect(firstInvalidStep({ location: "x", notes: "y" })).toBe("place");
    expect(firstInvalidStep({ notes: "x" })).toBe("details");
    expect(firstInvalidStep({})).toBeNull();
  });
});
