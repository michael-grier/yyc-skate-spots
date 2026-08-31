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

## Linked worktrees

T3 Code runs `bun run setup:worktree` when it creates a worktree. Run it once yourself in a
manually created worktree. It links `.env` and `.env.local` to the primary checkout, so edit those
shared files only from the primary checkout. Propose environment-contract changes in the tracked
`.env.example` instead.
