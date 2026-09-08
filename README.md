# YYC Skate Spots

A street skateboarding spot book for Calgary, built with Expo SDK 57, React Native 0.86,
Expo Router, Convex, Clerk, react-native-maps, and NativeWind v4. Bun is the package manager;
`bun.lock` is the dependency source of truth. The current release targets iOS; Android release
work is deferred.

## Get started

Use a custom development build for this project's native configuration, including authentication,
Google Maps keys, and Universal Links. Expo Go does not replace verification in that build.

1. Install Bun and obtain access to the existing development services from the maintainer.
2. Follow [development setup](docs/development.md) for local environment configuration and device
   installation. In a T3 Code worktree, `bun run setup:worktree` runs automatically; run it once
   yourself for a manually created worktree.
3. Run `bun run start` and open the installed development client. If backend changes need a
   watcher, run `bun x convex dev` in a separate terminal against development. Only one watcher
   should target the shared deployment at a time.

## Google Maps API keys

Both keys are required by EAS builds. Use separate keys restricted to the app identifier, Maps
SDK, and Android signing certificates as applicable. See [service configuration](docs/development.md#service-configuration)
for setup and [the environment inventory](docs/production-environments.md) for rotation.

## Share links

Set `EXPO_PUBLIC_SHARE_BASE_URL` to the public HTTPS origin without a path, query, fragment,
credentials, or port. It configures share links and the iOS associated-domain entitlement.
See [public-site setup](docs/public-site.md) for the fallback pages and association file.

## Pull request checks

Run the same checks as CI before opening a pull request:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run test
bun run test:ui -- --runInBand
bun x --no-install expo-doctor
bun run verify:ios-release
bun x expo export --platform ios
```

These checks do not require production credentials or access to EAS, Clerk, Convex, Google, or
Apple accounts.

## Documentation

| Document | Purpose |
| --- | --- |
| [Development](docs/development.md) | Local setup, worktrees, native builds, and seed ownership |
| [Development fixtures](docs/development-fixtures.md) | Repeatable manual moderation checks |
| [Public site](docs/public-site.md) | Static page builds and Cloudflare Pages configuration |
| [Production environments](docs/production-environments.md) | Configuration ownership and rotation |
| [iOS release runbook](docs/ios-release-runbook.md) | Production builds and TestFlight uploads |
| [iOS data inventory](docs/ios-data-inventory.md) | Data flows and App Store privacy answers |
| [App Store listing](docs/app-store-listing.md) | Maintained listing copy and selections |
| [App Review notes](docs/app-review-notes.md) | Reviewer account lifecycle and submission notes |
| [App Store screenshots](docs/app-store-screenshots.md) | Asset locations, order, and capture guidance |
| [Version 1.0 release record](docs/releases/1.0.md) | Historical submission and launch-data evidence |

## Scripts

| Command | What it does |
| --- | --- |
| `bun run start` | Start Metro |
| `bun run setup:worktree` | Link local env files and install dependencies |
| `bun run typecheck` | Check TypeScript |
| `bun run lint` | Run ESLint |
| `bun run test` | Run Vitest unit tests |
| `bun run test:ui -- --runInBand` | Run Jest UI tests |
| `bun run build:share-site` | Build public pages and the Apple association file |
| `bun run verify:ios-release` | Verify resolved iOS release configuration |
| `bun run format` | Format with Biome |

## Architecture notes

- `app.config.ts` reads native configuration from environment variables. Maps keys are embedded
  in the native binary. Expo substitutes `EXPO_PUBLIC_*` values into the JavaScript bundle;
  changing a provider dashboard value does not reconfigure an installed bundle.
- `src/app/` contains Expo Router's file-based routes.
- Convex enforces authentication, ownership, moderation roles, and contribution restrictions.
  Public browsing and sharing do not require an account.
- Distance filtering runs client-side over the reactive spot query for the Calgary dataset.
- Icon sources live in `assets/brand/*.svg`. Render each corresponding `assets/images/*.png`
  with `inkscape -w N -h N assets/brand/<name>.svg -o assets/images/<name>.png`, using that PNG's
  existing dimensions. Edit the SVG source when changing an icon.
