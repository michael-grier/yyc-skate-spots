/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { legacySubmissionReason, reviewAttention } from "./moderationModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const SPOT = {
  name: "Test Ledge",
  types: ["ledge" as const],
  bustFactor: "low" as const,
  latitude: 51.0447,
  longitude: -114.0719,
  photoIds: [] as Id<"_storage">[],
};
const PAGE = { paginationOpts: { numItems: 10, cursor: null } };
const MESSAGE = "Move the pin to the north rail and add a photo of the run-up.";

function setup() {
  const t = convexTest(schema, modules);
  return {
    t,
    asAlice: t.withIdentity({ subject: "alice", tokenIdentifier: "clerk|alice" }),
    asBob: t.withIdentity({ subject: "bob", tokenIdentifier: "clerk|bob" }),
    asAdmin: t.withIdentity({ subject: "admin", role: "admin", tokenIdentifier: "clerk|admin" }),
  };
}

async function pendingSpot({ asAlice }: ReturnType<typeof setup>) {
  await asAlice.mutation(api.moderation.acknowledgeStandards, {});
  return await asAlice.mutation(api.spots.create, SPOT);
}

describe("review state", () => {
  test("reports wait while a spot is sent back, and otherwise decide the reason", () => {
    expect(reviewAttention("pending", 0, "new")).toEqual({
      needsReview: true,
      attentionReason: "new",
    });
    expect(reviewAttention("published", 2, "edited")).toEqual({
      needsReview: true,
      attentionReason: "reported",
    });
    expect(reviewAttention("needs_changes", 2, "new")).toEqual({
      needsReview: false,
      attentionReason: "new",
    });
    expect(reviewAttention("published", 0, "resubmitted").needsReview).toBe(false);
  });

  test("rows from before submissionReason recover it from their submission time", () => {
    const row = { spotCreationTime: 100, lastSubmittedAt: 100 } as const;
    expect(legacySubmissionReason({ ...row, attentionReason: "edited" })).toBe("edited");
    expect(legacySubmissionReason({ ...row, attentionReason: "reported" })).toBe("new");
    expect(
      legacySubmissionReason({ ...row, attentionReason: "reported", lastSubmittedAt: 200 }),
    ).toBe("edited");
    expect(
      legacySubmissionReason({
        ...row,
        attentionReason: "reported",
        submissionReason: "resubmitted",
      }),
    ).toBe("resubmitted");
  });
});

describe("request changes", () => {
  test("sends a spot back, then publishes the resubmission with the owner's note", async () => {
    const harness = setup();
    const { t, asAlice, asAdmin } = harness;
    const id = await pendingSpot(harness);

    await asAdmin.mutation(api.moderation.requestChanges, {
      spotId: id,
      message: `  ${MESSAGE}  `,
    });
    expect(await t.query(api.spots.get, { id })).toBeNull();
    expect(await asAdmin.query(api.moderation.reviewCount, {})).toBe(0);
    expect(await asAlice.query(api.spots.get, { id })).toMatchObject({
      isPendingReview: false,
      changesRequested: { message: MESSAGE },
    });
    expect(await asAlice.query(api.spots.mine, {})).toMatchObject([{ status: "needs_changes" }]);
    expect((await asAlice.query(api.notices.list, PAGE)).page).toMatchObject([
      { kind: "spot_changes_requested", spotId: id, message: MESSAGE },
    ]);
    await expect(
      asAdmin.mutation(api.moderation.markMeetsStandards, { spotId: id }),
    ).rejects.toThrow(/waiting on its contributor/);

    await asAlice.mutation(api.spots.update, { ...SPOT, id, ownerNote: " Moved the pin. " });
    const review = await asAdmin.query(api.moderation.getSpot, { id });
    expect(review?.publicationStatus).toBe("pending");
    expect(review?.review).toMatchObject({
      needsReview: true,
      attentionReason: "resubmitted",
      requestedChanges: { message: MESSAGE },
      ownerNote: "Moved the pin.",
    });

    await asAdmin.mutation(api.moderation.markMeetsStandards, { spotId: id });
    expect(await t.query(api.spots.get, { id })).not.toBeNull();
    expect((await asAdmin.query(api.moderation.getSpot, { id }))?.review).toMatchObject({
      requestedChanges: null,
      ownerNote: null,
    });
    // Once published, a later edit is an ordinary edit again.
    await asAlice.mutation(api.spots.update, { ...SPOT, id, notes: "Later edit" });
    expect((await asAdmin.query(api.moderation.getSpot, { id }))?.review.attentionReason).toBe(
      "edited",
    );
  });

  test("never touches a live spot and needs a real message", async () => {
    const harness = setup();
    const { asAdmin } = harness;
    const id = await pendingSpot(harness);
    await expect(
      asAdmin.mutation(api.moderation.requestChanges, { spotId: id, message: "fix it" }),
    ).rejects.toThrow(/characters/);
    await asAdmin.mutation(api.moderation.markMeetsStandards, { spotId: id });
    await expect(
      asAdmin.mutation(api.moderation.requestChanges, { spotId: id, message: MESSAGE }),
    ).rejects.toThrow(/waiting for review/);
  });

  test("reports wait for the resubmission, then come back first", async () => {
    const harness = setup();
    const { asAlice, asBob, asAdmin } = harness;
    const id = await pendingSpot(harness);
    await asAdmin.mutation(api.moderation.markMeetsStandards, { spotId: id });
    await asBob.mutation(api.reports.create, { spotId: id, reason: "not_a_spot" });
    // An in-place edit takes the spot back to pending with its report still open.
    await asAlice.mutation(api.spots.update, { ...SPOT, id, notes: "Edited" });

    await asAdmin.mutation(api.moderation.requestChanges, { spotId: id, message: MESSAGE });
    expect((await asAdmin.query(api.moderation.getSpot, { id }))?.review).toMatchObject({
      needsReview: false,
      openReportCount: 1,
    });
    expect((await asBob.query(api.notices.list, PAGE)).page).toEqual([]);

    await asAlice.mutation(api.spots.update, { ...SPOT, id });
    expect((await asAdmin.query(api.moderation.getSpot, { id }))?.review).toMatchObject({
      needsReview: true,
      attentionReason: "reported",
    });
  });

  test("a decision made on a stale screen is refused", async () => {
    const harness = setup();
    const { asBob, asAdmin } = harness;
    const id = await pendingSpot(harness);
    await asAdmin.mutation(api.moderation.markMeetsStandards, { spotId: id });
    const seen = (await asAdmin.query(api.moderation.getSpot, { id }))?.review.reviewVersion;

    // A report arrives while the admin's screen still shows the clean version.
    await asBob.mutation(api.reports.create, { spotId: id, reason: "not_a_spot" });
    await expect(
      asAdmin.mutation(api.moderation.markMeetsStandards, {
        spotId: id,
        expectedReviewVersion: seen,
      }),
    ).rejects.toThrow(/changed while you were reviewing/);

    const current = (await asAdmin.query(api.moderation.getSpot, { id }))?.review.reviewVersion;
    expect(current).toBeGreaterThan(seen ?? 0);
    await asAdmin.mutation(api.moderation.markMeetsStandards, {
      spotId: id,
      expectedReviewVersion: current,
    });
  });
});
