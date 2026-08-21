import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

// Generous ceiling; the app downscales photos to a few hundred KB before
// sending, so anything near this is not a photo from the form.
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const http = httpRouter();

/**
 * Authenticated photo upload. Storing the file and recording its uploader
 * happen in one request, so there is never a stored-but-unowned file that
 * another user could register as their own, and a failure after the store
 * deletes the file rather than orphaning it.
 */
http.route({
  path: "/upload",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return new Response("Sign in required", { status: 401 });
    }
    const contentType = request.headers.get("Content-Type") ?? "";
    if (!contentType.startsWith("image/")) {
      return new Response("Images only", { status: 415 });
    }
    const blob = await request.blob();
    if (blob.size === 0 || blob.size > MAX_UPLOAD_BYTES) {
      return new Response("Image is empty or too large", { status: 413 });
    }

    const storageId = await ctx.storage.store(blob);
    try {
      await ctx.runMutation(internal.spots.recordUpload, { storageId });
    } catch (error) {
      await ctx.storage.delete(storageId);
      throw error;
    }
    return Response.json({ storageId });
  }),
});

export default http;
