/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const fields = {
  name: "Rails",
  types: ["handrail" as const],
  bustFactor: "low" as const,
  latitude: 51,
  longitude: -114,
  photoIds: [],
};
async function setup(allowed = true) {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "owner", tokenIdentifier: "clerk|owner" });
  const admin = t.withIdentity({ subject: "admin", tokenIdentifier: "clerk|admin", role: "admin" });
  await owner.mutation(api.moderation.acknowledgeStandards, {});
  await admin.mutation(api.moderation.acknowledgeStandards, {});
  const id = await owner.mutation(api.spots.create, { ...fields, allowAdminPhotos: allowed });
  const photoId = await t.run((ctx) =>
    ctx.storage.store(new Blob(["photo"], { type: "image/jpeg" })),
  );
  await admin.mutation(internal.spots.recordUpload, { storageId: photoId });
  return { t, owner, admin, id, photoId };
}

describe("admin spot photos", () => {
  test("requires explicit owner consent and an authenticated, unblocked admin", async () => {
    const { t, owner, admin, id, photoId } = await setup(false);
    const upload = { id, photoIds: [photoId] };
    await expect(t.mutation(api.spots.addAdminPhotos, upload)).rejects.toThrow(/signed in/);
    await expect(owner.mutation(api.spots.addAdminPhotos, upload)).rejects.toThrow(/Administrator/);
    await expect(admin.mutation(api.spots.addAdminPhotos, upload)).rejects.toThrow(/permission/);
    await expect(
      admin.mutation(api.spots.setAdminPhotoPermission, { id, allowed: true }),
    ).rejects.toThrow(/person who added/);
    await owner.mutation(api.spots.setAdminPhotoPermission, { id, allowed: true });
    expect((await admin.query(api.moderation.listSpots, {}))[0].canAddAdminPhotos).toBe(true);
    await t.run((ctx) =>
      ctx.db.insert("userModeration", {
        userIdentifier: "clerk|admin",
        confirmedRemovalCount: 3,
        isBanned: true,
      }),
    );
    await expect(admin.mutation(api.spots.addAdminPhotos, upload)).rejects.toThrow(
      /contribution access/,
    );
  });

  test("honours permission withdrawal during upload without changing review status", async () => {
    const { t, owner, admin, id, photoId } = await setup();
    const before = await admin.query(api.moderation.getSpot, { id });
    await owner.mutation(api.spots.setAdminPhotoPermission, { id, allowed: false });
    await expect(
      admin.mutation(api.spots.addAdminPhotos, { id, photoIds: [photoId] }),
    ).rejects.toThrow(/permission/);
    expect((await admin.query(api.moderation.getSpot, { id }))?.review).toEqual(before?.review);
    await admin.mutation(api.spots.discardUpload, { storageId: photoId });
    expect(await t.run((ctx) => ctx.storage.get(photoId))).toBeNull();
  });

  test("adds only the admin's distinct photos and preserves pending reviews and details", async () => {
    const { t, owner, admin, id, photoId } = await setup();
    const before = await t.run((ctx) => ctx.db.get("spots", id));
    const review = (await admin.query(api.moderation.getSpot, { id }))?.review;
    const otherPhoto = await t.run((ctx) => ctx.storage.store(new Blob(["other"])));
    await owner.mutation(internal.spots.recordUpload, { storageId: otherPhoto });
    await expect(
      admin.mutation(api.spots.addAdminPhotos, { id, photoIds: [otherPhoto] }),
    ).rejects.toThrow(/uploaded by you/);
    for (const photoIds of [[], [photoId, photoId], Array(7).fill(photoId)]) {
      await expect(admin.mutation(api.spots.addAdminPhotos, { id, photoIds })).rejects.toThrow(
        /different photos/,
      );
    }
    await admin.mutation(api.spots.addAdminPhotos, { id, photoIds: [photoId] });
    const after = await t.run((ctx) => ctx.db.get("spots", id));
    expect(after).toEqual({
      ...before,
      photoIds: [photoId],
      allowAdminPhotos: false,
      adminPhotosUnseen: true,
      adminPhotosAddedAt: expect.any(Number),
    });
    expect((await admin.query(api.moderation.getSpot, { id }))?.review).toEqual(review);
    expect(await t.query(api.spots.get, { id })).toBeNull();
    await expect(
      owner.mutation(api.spots.setAdminPhotoPermission, { id, allowed: true }),
    ).rejects.toThrow(/already has photos/);
    await expect(
      admin.mutation(api.spots.update, {
        id,
        ...fields,
        expectedAdminPhotosAddedAt: after?.adminPhotosAddedAt,
      }),
    ).rejects.toThrow(/person who added/);
  });

  test("preserves published visibility and limits the unread indicator to the owner", async () => {
    const { t, owner, admin, id, photoId } = await setup();
    await admin.mutation(api.moderation.markMeetsStandards, { spotId: id });
    await admin.mutation(api.spots.addAdminPhotos, { id, photoIds: [photoId] });
    expect((await owner.query(api.spots.mine, {}))[0]).toMatchObject({
      status: "active",
      adminPhotosUnseen: true,
    });
    const ownSpot = await owner.query(api.spots.get, { id });
    if (ownSpot?.status !== "active" || ownSpot.adminPhotosAddedAt === undefined)
      throw new Error("Missing uploaded photos");
    expect(ownSpot.photoIds).toEqual([photoId]);
    for (const result of [
      await t.query(api.spots.get, { id }),
      (await t.query(api.spots.list, {}))[0],
    ]) {
      expect(result).not.toHaveProperty("adminPhotosUnseen");
      expect(result).not.toHaveProperty("adminPhotosAddedAt");
      expect(result).not.toHaveProperty("allowAdminPhotos");
    }
    await expect(
      admin.mutation(api.spots.markAdminPhotosSeen, { id, addedAt: ownSpot.adminPhotosAddedAt }),
    ).rejects.toThrow(/person who added/);
    await owner.mutation(api.spots.markAdminPhotosSeen, {
      id,
      addedAt: ownSpot.adminPhotosAddedAt - 1,
    });
    expect((await owner.query(api.spots.mine, {}))[0]).toMatchObject({ adminPhotosUnseen: true });
    await owner.mutation(api.spots.markAdminPhotosSeen, {
      id,
      addedAt: ownSpot.adminPhotosAddedAt,
    });
    expect((await owner.query(api.spots.mine, {}))[0]).toMatchObject({ adminPhotosUnseen: false });
  });

  test("rejects stale owner edits, then permits deliberate photo removal and renewed consent", async () => {
    const { t, owner, admin, id, photoId } = await setup();
    await admin.mutation(api.spots.addAdminPhotos, { id, photoIds: [photoId] });
    await expect(owner.mutation(api.spots.update, { id, ...fields })).rejects.toThrow(
      /Reopen the editor/,
    );
    const spot = await t.run((ctx) => ctx.db.get("spots", id));
    await owner.mutation(api.spots.update, {
      id,
      ...fields,
      allowAdminPhotos: true,
      expectedAdminPhotosAddedAt: spot?.adminPhotosAddedAt,
    });
    expect(await t.run((ctx) => ctx.storage.get(photoId))).toBeNull();
    expect((await admin.query(api.moderation.getSpot, { id }))?.canAddAdminPhotos).toBe(true);
    expect((await owner.query(api.spots.mine, {}))[0]).toMatchObject({ adminPhotosUnseen: false });
  });

  test.each(["owner", "moderation", "account"])(
    "cleans up admin photos on %s deletion",
    async (kind) => {
      const { t, owner, admin, id, photoId } = await setup();
      await admin.mutation(api.spots.addAdminPhotos, { id, photoIds: [photoId] });
      if (kind === "owner") await owner.mutation(api.spots.remove, { id });
      if (kind === "moderation")
        await admin.mutation(api.moderation.removeSpot, { spotId: id, reason: "gone_or_unusable" });
      if (kind === "account") {
        const requestId = await t.mutation(internal.accountDeletion.beginRequest, {
          userIdentifier: "clerk|owner",
          clerkUserId: "owner",
        });
        for (let i = 0; i < 10; i++)
          if (await t.mutation(internal.accountDeletion.cleanupBatch, { requestId })) break;
      }
      expect(await t.run((ctx) => ctx.storage.get(photoId))).toBeNull();
      expect(await t.run((ctx) => ctx.db.query("spotPhotos").collect())).toEqual([]);
    },
  );
});
