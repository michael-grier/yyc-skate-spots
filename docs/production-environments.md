# Production environment inventory

This file records where production configuration belongs and how to rotate it. It deliberately
contains no environment values. Read values from the named provider dashboard or CLI, and never
copy them into Git, an issue, a pull request, or a build log.

## EAS production

All entries have project scope and belong to the Expo project owner. `EXPO_PUBLIC_*` values and
native map keys are recoverable from a built app. EAS visibility controls logs and dashboard
display, not whether an app user can extract a value.

| Variable | Owner | Visibility | Source and consumer | Rotation procedure |
| --- | --- | --- | --- | --- |
| `EXPO_PUBLIC_CONVEX_URL` | Expo project owner | Plain text | Convex production deployment URL, consumed by the Expo client | Create or select the replacement production deployment, update EAS, build and test against it, then retire the old deployment only after its data has moved. |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Expo project owner | Plain text | Clerk production API Keys page, consumed by `ClerkProvider` | When Clerk issues a replacement, update EAS, then make a new build and verify sign-in before retiring the old configuration. A Clerk domain change creates a new key. |
| `EXPO_PUBLIC_SHARE_BASE_URL` | Expo project owner | Plain text | Cloudflare Pages production custom domain, consumed by Expo configuration and share links | Configure the replacement domain and association file first. Update Cloudflare Pages and EAS, make a new build, verify Universal Links, then redirect or retire the old domain. |
| `GOOGLE_MAPS_API_KEY_IOS` | Expo project owner | Sensitive | Google Cloud credential restricted to the iOS bundle ID and Maps SDK for iOS, embedded by Expo at build time | Create and restrict a replacement key, update EAS, build and test the map on an iPhone, then revoke the old key. |
| `GOOGLE_MAPS_API_KEY_ANDROID` | Expo project owner | Sensitive | Google Cloud credential restricted to the Android package, signing certificates, and Maps SDK for Android, embedded by Expo at build time | Android is deferred, but the current app configuration still requires this variable for every build. Add the replacement signing fingerprints, update EAS, test an Android build when Android work resumes, then revoke the old key. |

## Convex production

These variables belong to the Convex project owner and are scoped to the production deployment.
Use `bun x convex env list --names-only --prod` to inspect names without printing values.

| Variable | Owner | Visibility | Requirement | Source and consumer | Rotation procedure |
| --- | --- | --- | --- | --- | --- |
| `CLERK_JWT_ISSUER_DOMAIN` | Convex project owner | Public configuration | Required | Frontend API URL from the matching Clerk production Convex integration, consumed by `convex/auth.config.ts` | Finish the replacement Clerk domain or instance first. Set the new URL on Convex, deploy the auth configuration, and verify an authenticated request before retiring the old Clerk configuration. |
| `SEED_OWNER_TOKEN_IDENTIFIER` | Convex project owner | Non-secret account identifier | Optional | Canonical Clerk identity for deliberate seed and ownership operations, consumed only by guarded seed functions | Set it to the intended account's Frontend API URL and user ID pair before an approved seed or claim operation. Change or remove it when that owner changes or seeding is no longer allowed. |
| `TEST_FIXTURES_ENABLED` | Convex project owner | Internal feature flag | Development only | Manual moderation fixture gate, consumed by fixture functions | Keep it absent from production. If it appears there, remove it immediately. Enable it only on development for a specific fixture run and remove it afterward. |

## Cloudflare Pages

These build variables belong to the Cloudflare Pages project owner. Configure each one for both
Production and Preview. Their values are public identifiers or build settings.

| Variable | Owner | Visibility | Source and consumer | Rotation procedure |
| --- | --- | --- | --- | --- |
| `EXPO_PUBLIC_SHARE_BASE_URL` | Cloudflare Pages project owner | Plain text | Pages custom domain, consumed by the share-site builder | Update it with the EAS value during a domain change, redeploy, and verify both `/share` and the Apple association file. |
| `APPLE_TEAM_ID` | Cloudflare Pages project owner | Plain text | Apple Developer membership, consumed by the association-file builder | Update it only when app ownership moves to another Apple team, then redeploy and verify the association file before building the transferred app. |
| `APP_STORE_ID` | Cloudflare Pages project owner | Plain text | App Store Connect app record, consumed by the share fallback page | Update it if the app record is replaced, redeploy, and verify the App Store link before publishing the page. |
| `SKIP_DEPENDENCY_INSTALL` | Cloudflare Pages project owner | Plain text | Cloudflare build setting, consumed by the Pages build | Keep it enabled while the share builder uses only Node built-ins. Remove it only if the share-site build gains an installed dependency. |

## Clerk production

The production Clerk instance, domain, Convex integration, publishable key, users, and role
metadata belong to the Clerk application owner. Development and production users are separate.
The administrator's public metadata contains the `admin` role, and the session token maps only
that role into the top-level `role` claim. Apple and Google credentials are configured and tested
under issue #16 rather than stored in this repository.

## Launch data

The initial production dataset contains the public development spot set copied at provisioning
time. The import discarded development IDs, photos, favorites, reports, deletion state, and
moderation history. Every imported spot is published and assigned to the production
administrator's Clerk identity. Future data migrations need their own reviewed export,
transformation, empty-target or conflict check, import, and ownership verification.

## Verification and incident response

- Confirm the Expo dashboard lists all five expected production names. Do not copy their values
  into logs.
- Confirm Convex lists the two expected names and does not list `TEST_FIXTURES_ENABLED`.
- Confirm the production share domain serves `/share` and the Apple association file over HTTPS.
- Confirm map-key application and API restrictions in Google Cloud before each release build.
- After any suspected disclosure, create a replacement at the provider, update its consumers,
  verify a new build or deployment, then revoke the old credential.

Provider references: [EAS environment variables](https://docs.expo.dev/eas/environment-variables/),
[Convex environment variables](https://docs.convex.dev/production/environment-variables), and
[Clerk's Convex integration](https://clerk.com/docs/guides/development/integrations/databases/convex).
