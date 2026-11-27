/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type Harness = ReturnType<typeof convexTest>;
type Identity = ReturnType<Harness["withIdentity"]>;

const SPOT = {
  name: "Test Gap",
  types: ["gap" as const],
  bustFactor: "low" as const,
  notes: "Patch the crack in the landing.",
  latitude: 51.0447,
  longitude: -114.0719,
  photoIds: [] as Id<"_storage">[],
};

/** Stores a file and records `as` as its uploader, as the /upload action does. */
async function uploadAs(t: Harness, as: Identity, bytes: string) {
  const storageId = await t.run(async (ctx) => await ctx.storage.store(new Blob([bytes])));
  await as.mutation(internal.spots.recordUpload, { storageId });
  return storageId;
}

/** Alice's published, tagged spot, plus Sam who fixes it and an admin. */
async function setup() {
  const t = convexTest(schema, modules);
  const asAlice = t.withIdentity({ subject: "alice" });
  const asSam = t.withIdentity({ subject: "sam" });
  const asAdmin = t.withIdentity({ subject: "admin", role: "admin" });
  for (const as of [asAlice, asSam, asAdmin]) {
    await as.mutation(api.moderation.acknowledgeStandards, {});
  }
  await asSam.mutation(api.profiles.setDisplayName, { displayName: "Sam R." });
  const spotId = await asAlice.mutation(api.spots.create, { ...SPOT, needsWork: true });
  await asAdmin.mutation(api.moderation.markMeetsStandards, { spotId });
  return { t, asAlice, asSam, asAdmin, spotId };
}

/** The pending fix's ID, as the admin review screen gets it. */
async function pendingWorkId(asAdmin: Identity, spotId: Id<"spots">) {
  const spot = await asAdmin.query(api.moderation.getSpot, { id: spotId });
  if (!spot?.workSubmission) throw new Error("Expected a pending fix.");
  return spot.workSubmission._id;
}

describe("I fixed it", () => {
  test("a fix needs a published, tagged spot and 1–3 of the sender's own photos", async () => {
    const { t, asAlice, asSam, asAdmin, spotId } = await setup();
    const photo = await uploadAs(t, asSam, "after");

    await expect(asSam.mutation(api.spotWork.submit, { spotId, photoIds: [] })).rejects.toThrow(
      /1–3/,
    );
    const alicesPhoto = await uploadAs(t, asAlice, "not sam's");
    await expect(
      asSam.mutation(api.spotWork.submit, { spotId, photoIds: [alicesPhoto] }),
    ).rejects.toThrow(/uploaded by you/);

    const pendingId = await asAlice.mutation(api.spots.create, { ...SPOT, needsWork: true });
    await expect(
      asSam.mutation(api.spotWork.submit, { spotId: pendingId, photoIds: [photo] }),
    ).rejects.toThrow(/not found/);
    const untaggedId = await asAlice.mutation(api.spots.create, SPOT);
    await expect(
      asSam.mutation(api.spotWork.submit, { spotId: untaggedId, photoIds: [photo] }),
    ).rejects.toThrow(/not found|isn't tagged/);

    const ownersPhoto = await uploadAs(t, asAlice, "own fix");
    await expect(
      asAlice.mutation(api.spotWork.submit, { spotId, photoIds: [ownersPhoto] }),
    ).rejects.toThrow(/your own spot/);

    await asSam.mutation(api.spotWork.submit, { spotId, photoIds: [photo], details: " Bondo. " });
    const second = await uploadAs(t, asAdmin, "second fix");
    await expect(
      asAdmin.mutation(api.spotWork.submit, { spotId, photoIds: [second] }),
    ).rejects.toThrow(/already sent/);
  });

  test("while a fix is pending the owner can't take the credit away", async () => {
    const { t, asAlice, asSam, spotId } = await setup();
    const photo = await uploadAs(t, asSam, "after");
    await asSam.mutation(api.spotWork.submit, { spotId, photoIds: [photo] });

    expect(await asSam.query(api.spots.get, { id: spotId })).toMatchObject({ pendingFix: "mine" });
    expect(await t.query(api.spots.get, { id: spotId })).toMatchObject({ pendingFix: "other" });
    await expect(
      asAlice.mutation(api.spots.setNeedsWork, { id: spotId, needsWork: false }),
    ).rejects.toThrow(/can't be removed/);
    await expect(
      asAlice.mutation(api.spots.update, { id: spotId, ...SPOT, visibility: "private" }),
    ).rejects.toThrow(/made private once/);

    // Deleting the spot is still the owner's call, and takes the fix with it.
    await asAlice.mutation(api.spots.remove, { id: spotId });
    expect(await t.run((ctx) => ctx.db.query("spotWork").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.storage.getUrl(photo))).toBeNull();
  });

  test("approving retires the tag and credits the photos to whoever fixed it", async () => {
    const { t, asAlice, asSam, asAdmin, spotId } = await setup();
    const photo = await uploadAs(t, asSam, "after");
    await asSam.mutation(api.spotWork.submit, { spotId, photoIds: [photo] });
    expect(await asAdmin.query(api.moderation.reviewCount, {})).toBe(1);
    expect(await asAdmin.query(api.moderation.getSpot, { id: spotId })).toMatchObject({
      workSubmission: { photoUrls: [expect.any(String)] },
    });
    const workId = await pendingWorkId(asAdmin, spotId);
    await expect(asSam.mutation(api.spotWork.accept, { workId })).rejects.toThrow(/Administrator/);

    await asAdmin.mutation(api.spotWork.accept, { workId });
    const spot = await t.query(api.spots.get, { id: spotId });
    expect(spot).toMatchObject({
      needsWork: false,
      pendingFix: null,
      fix: { by: "Sam R.", photoUrls: [expect.any(String)] },
    });
    // The spot has no photos of its own, so the fix supplies the map preview.
    expect(await t.query(api.spots.list, {})).toMatchObject([
      { previewPhotoUrl: expect.any(String) },
    ]);
    expect(await asAdmin.query(api.moderation.reviewCount, {})).toBe(0);
    await expect(
      asAlice.mutation(api.spots.setNeedsWork, { id: spotId, needsWork: true }),
    ).rejects.toThrow(/already been fixed/);
    // An edit must keep the lock, since update replaces the whole document.
    await asAlice.mutation(api.spots.update, { id: spotId, ...SPOT, name: "Renamed" });
    await expect(
      asAlice.mutation(api.spots.setNeedsWork, { id: spotId, needsWork: true }),
    ).rejects.toThrow(/already been fixed/);
  });

  test("an admin can take down approved photos without striking the owner", async () => {
    const { t, asAlice, asSam, asAdmin, spotId } = await setup();
    const photo = await uploadAs(t, asSam, "after");
    await asSam.mutation(api.spotWork.submit, { spotId, photoIds: [photo] });
    const workId = await pendingWorkId(asAdmin, spotId);
    // A pending fix goes through reject, which reopens the spot.
    await expect(asAdmin.mutation(api.spotWork.removeApproved, { workId })).rejects.toThrow(
      /isn't on the spot/,
    );
    await asAdmin.mutation(api.spotWork.accept, { workId });
    expect(await asAdmin.query(api.moderation.getSpot, { id: spotId })).toMatchObject({
      approvedFix: { _id: workId, submitterName: "Sam R." },
      workSubmission: null,
    });
    await expect(asSam.mutation(api.spotWork.removeApproved, { workId })).rejects.toThrow(
      /Administrator/,
    );

    await asAdmin.mutation(api.spotWork.removeApproved, { workId });
    expect(await t.run((ctx) => ctx.storage.getUrl(photo))).toBeNull();
    expect(await t.query(api.spots.get, { id: spotId })).toMatchObject({
      needsWork: false,
      isFixed: true,
      fix: null,
    });
    expect(await asAdmin.query(api.moderation.getSpot, { id: spotId })).toMatchObject({
      approvedFix: null,
      creator: { confirmedRemovalCount: 0 },
    });
    await expect(
      asAlice.mutation(api.spots.setNeedsWork, { id: spotId, needsWork: true }),
    ).rejects.toThrow(/already been fixed/);
  });

  test("an admin can't take down fix photos once the owner makes the spot private", async () => {
    const { t, asAlice, asSam, asAdmin, spotId } = await setup();
    const photo = await uploadAs(t, asSam, "after");
    await asSam.mutation(api.spotWork.submit, { spotId, photoIds: [photo] });
    const workId = await pendingWorkId(asAdmin, spotId);
    await asAdmin.mutation(api.spotWork.accept, { workId });
    await asAlice.mutation(api.spots.update, { id: spotId, ...SPOT, visibility: "private" });
    await expect(asAdmin.mutation(api.spotWork.removeApproved, { workId })).rejects.toThrow(
      /not found/,
    );
    expect(await t.run((ctx) => ctx.storage.getUrl(photo))).not.toBeNull();
  });

  test("rejecting deletes the photos and reopens the spot for another fix", async () => {
    const { t, asSam, asAdmin, spotId } = await setup();
    const photo = await uploadAs(t, asSam, "after");
    await asSam.mutation(api.spotWork.submit, { spotId, photoIds: [photo] });

    const workId = await pendingWorkId(asAdmin, spotId);
    await asAdmin.mutation(api.spotWork.reject, { workId });
    expect(await t.run((ctx) => ctx.storage.getUrl(photo))).toBeNull();
    expect(await t.query(api.spots.get, { id: spotId })).toMatchObject({
      needsWork: true,
      pendingFix: null,
      fix: null,
    });
    const retry = await uploadAs(t, asSam, "better fix");
    await asSam.mutation(api.spotWork.submit, { spotId, photoIds: [retry] });
    // A second admin still looking at the rejected fix can't approve its replacement.
    await expect(asAdmin.mutation(api.spotWork.accept, { workId })).rejects.toThrow(/reviewed/);
  });
});
