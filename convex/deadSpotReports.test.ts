/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const spotFields = {
  name: "Rails",
  types: ["handrail" as const],
  bustFactor: "low" as const,
  latitude: 51,
  longitude: -114,
  photoIds: [],
};

async function setup() {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "clerk|owner" });
  const reporter = t.withIdentity({ subject: "reporter", tokenIdentifier: "clerk|reporter" });
  const admin = t.withIdentity({ subject: "admin", role: "admin" });
  await owner.mutation(api.moderation.acknowledgeStandards, {});
  const spotId = await owner.mutation(api.spots.create, spotFields);
  await admin.mutation(api.moderation.markMeetsStandards, { spotId });
  const photoId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["evidence"], { type: "image/jpeg" })),
  );
  await reporter.mutation(internal.reportPhotos.recordUpload, { storageId: photoId });
  return { t, owner, reporter, admin, spotId, photoId };
}

describe("dead-spot reports", () => {
  test("requires fresh, distinct evidence owned by the reporter", async () => {
    const { t, reporter, owner, spotId, photoId } = await setup();
    const report = { spotId, reason: "gone_or_unusable" as const };
    await expect(reporter.mutation(api.reports.create, report)).rejects.toThrow(
      /at least one photo/,
    );
    await expect(
      t.mutation(api.reports.create, { ...report, photoIds: [photoId] }),
    ).rejects.toThrow(/signed in/);
    await expect(
      owner.mutation(api.reports.create, { ...report, photoIds: [photoId] }),
    ).rejects.toThrow(/own spot/);
    const other = t.withIdentity({ subject: "other" });
    await expect(
      other.mutation(api.reports.create, { ...report, photoIds: [photoId] }),
    ).rejects.toThrow(/uploaded by you/);
    await expect(
      other.mutation(api.reportPhotos.discardUpload, { storageId: photoId }),
    ).rejects.toThrow(/not your/);
    await expect(
      reporter.mutation(api.reports.create, { ...report, photoIds: [photoId, photoId] }),
    ).rejects.toThrow(/different/);
    await expect(
      reporter.mutation(api.reports.create, {
        ...report,
        photoIds: [photoId, photoId, photoId, photoId],
      }),
    ).rejects.toThrow(/up to 3/);
    await expect(
      reporter.mutation(api.reports.create, { ...report, reason: "other", photoIds: [photoId] }),
    ).rejects.toThrow(/only supported/);
    // A public spot upload is not valid evidence, and evidence cannot become a spot photo.
    await reporter.mutation(api.moderation.acknowledgeStandards, {});
    const publicPhoto = await t.run((ctx) => ctx.storage.store(new Blob(["public"])));
    await reporter.mutation(internal.spots.recordUpload, { storageId: publicPhoto });
    await expect(
      reporter.mutation(api.reports.create, { ...report, photoIds: [publicPhoto] }),
    ).rejects.toThrow(/uploaded by you/);
    await expect(
      reporter.mutation(api.spots.create, { ...spotFields, photoIds: [photoId] }),
    ).rejects.toThrow(/uploaded by you/);
    await reporter.mutation(api.reports.create, { ...report, photoIds: [photoId] });
    const secondSpot = await owner.mutation(api.spots.create, spotFields);
    await expect(
      reporter.mutation(api.reports.create, { ...report, spotId: secondSpot, photoIds: [photoId] }),
    ).rejects.toThrow(/uploaded by you/);
  });

  test("evidence is returned only to admins and survives pending-upload cleanup after submission", async () => {
    const { t, reporter, admin, spotId, photoId } = await setup();
    await reporter.mutation(api.reports.create, {
      spotId,
      reason: "gone_or_unusable",
      photoIds: [photoId],
    });
    const review = await admin.query(api.moderation.getSpot, { id: spotId });
    expect(review?.reports[0].photoUrls).toHaveLength(1);
    expect(review?.review).toMatchObject({ needsReview: true, attentionReason: "reported" });
    for (const result of [
      await t.query(api.spots.get, { id: spotId }),
      await t.query(api.spots.list, {}),
    ]) {
      expect(JSON.stringify(result)).not.toContain(photoId);
      expect(JSON.stringify(result)).not.toContain(review?.reports[0].photoUrls[0]);
    }
    await expect(reporter.query(api.moderation.getSpot, { id: spotId })).rejects.toThrow(
      /Administrator/,
    );
    await t.mutation(internal.reportPhotos.expireUpload, { storageId: photoId });
    await reporter.mutation(api.reportPhotos.discardUpload, { storageId: photoId });
    expect(await t.run(async (ctx) => (await ctx.storage.get(photoId)) !== null)).toBe(true);
  });

  test.each(["approval", "admin removal", "owner deletion", "reporter deletion"])(
    "deletes evidence on %s",
    async (action) => {
      const { t, reporter, owner, admin, spotId, photoId } = await setup();
      await reporter.mutation(api.reports.create, {
        spotId,
        reason: "gone_or_unusable",
        photoIds: [photoId],
      });
      if (action === "approval")
        await admin.mutation(api.moderation.markMeetsStandards, { spotId });
      if (action === "admin removal")
        await admin.mutation(api.moderation.removeSpot, { spotId, reason: "gone_or_unusable" });
      if (action === "owner deletion") await owner.mutation(api.spots.remove, { id: spotId });
      if (action === "reporter deletion") {
        const pendingPhoto = await t.run((ctx) => ctx.storage.store(new Blob(["pending"])));
        await reporter.mutation(internal.reportPhotos.recordUpload, { storageId: pendingPhoto });
        const requestId = await t.mutation(internal.accountDeletion.beginRequest, {
          userIdentifier: "clerk|reporter",
          clerkUserId: "reporter",
        });
        for (let i = 0; i < 10; i++) {
          if (await t.mutation(internal.accountDeletion.cleanupBatch, { requestId })) break;
        }
        expect(await t.run((ctx) => ctx.storage.get(pendingPhoto))).toBeNull();
        expect((await admin.query(api.moderation.getSpot, { id: spotId }))?.review).toMatchObject({
          needsReview: false,
          openReportCount: 0,
        });
      }
      expect(await t.run((ctx) => ctx.storage.get(photoId))).toBeNull();
      expect(await t.run((ctx) => ctx.db.query("spotReports").collect())).toEqual([]);
    },
  );

  test("dead-spot removal preserves existing strikes and bans without offering a new ban", async () => {
    const { t, owner, admin, spotId } = await setup();
    const moderationId = await t.run((ctx) =>
      ctx.db.insert("userModeration", {
        userIdentifier: "clerk|owner",
        confirmedRemovalCount: 2,
        isBanned: false,
      }),
    );
    const result = await admin.mutation(api.moderation.removeSpot, {
      spotId,
      reason: "gone_or_unusable",
    });
    expect(result).toMatchObject({
      strikeCount: 0,
      eligibleForBan: false,
      contributorModerationId: null,
    });
    expect(await t.run((ctx) => ctx.db.get("userModeration", moderationId))).toMatchObject({
      confirmedRemovalCount: 2,
      isBanned: false,
    });
    expect(await owner.query(api.spots.get, { id: spotId })).toMatchObject({
      status: "removed",
      strikeNumber: 0,
    });
    expect(await owner.query(api.spots.mine, {})).toMatchObject([
      { status: "removed", strikeNumber: 0 },
    ]);
    const second = await owner.mutation(api.spots.create, spotFields);
    expect(
      await admin.mutation(api.moderation.removeSpot, { spotId: second, reason: "not_a_spot" }),
    ).toMatchObject({ strikeCount: 3, eligibleForBan: true });
  });

  test("abandons pending uploads safely and blocks banned reporters", async () => {
    const { t, reporter, photoId, spotId } = await setup();
    await t.mutation(internal.reportPhotos.expireUpload, { storageId: photoId });
    expect(await t.run((ctx) => ctx.storage.get(photoId))).toBeNull();
    await t.run((ctx) =>
      ctx.db.insert("userModeration", {
        userIdentifier: "clerk|reporter",
        confirmedRemovalCount: 3,
        isBanned: true,
      }),
    );
    await expect(
      reporter.mutation(internal.reportPhotos.recordUpload, { storageId: photoId }),
    ).rejects.toThrow(/contribution access/);
    await expect(
      reporter.mutation(api.reports.create, {
        spotId,
        reason: "gone_or_unusable",
        photoIds: [photoId],
      }),
    ).rejects.toThrow(/contribution access/);
  });
});
