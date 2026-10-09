# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Build variants

Development, preview, and production builds install side by side. Read
[build variants](docs/development.md#build-variants) before changing bundle IDs, URL schemes, app
icons, Apple sign-in, or `eas.json` profiles.

- `APP_VARIANT` selects the variant, and an unset value builds production. Set it on `expo config`
  or `expo prebuild` to inspect a non-production variant; `bun run start` sets `development`.
- `src/lib/app-variants.ts` is the source of bundle IDs and schemes; app code reads the running
  one from `appIdentity` in `src/lib/env.ts`. The only other literals are the production-only
  association file and release check, and Convex's `appleClientId` list in `convex/schema.ts`,
  which must name the same bundle IDs.

## Linked worktrees

T3 Code runs `bun run setup:worktree` when it creates a worktree. Run it once yourself in a
manually created worktree. It links `.env` and `.env.local` to the primary checkout, so edit those
shared files only from the primary checkout. Propose environment-contract changes in the tracked
`.env.example` instead.
