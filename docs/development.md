# Development setup

Use the existing YYC Skate Spots service projects. Creating a separate environment is a maintainer
operation, not a prerequisite for contributing. Never point fixture commands or a `convex dev`
watcher at production.

## Local environment

In a primary checkout, copy `.env.example` to `.env` only if `.env` does not already exist. Obtain
the development values through the maintainer's secure channel. Do not put them in Git or chat.
In a linked worktree, use the setup command below instead of copying or editing shared env files.

The app needs both Google Maps keys, `EXPO_PUBLIC_CONVEX_URL`, and
`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. Set `EXPO_PUBLIC_SHARE_BASE_URL` to the public HTTPS origin
for share links. It must have no path, query, fragment, credentials, or port. EAS builds reject a
missing or malformed origin; local configuration warns while the public site is being set up.
`EXPO_PUBLIC_CONVEX_SITE_URL` is required only for a custom Convex domain; default
`*.convex.cloud` deployments derive the HTTP-actions host automatically.

Run `bun install --frozen-lockfile`. When configuring `bun x convex dev` for the first time,
select the existing project and intended development deployment. Use its URL in the local env.
The watcher pushes functions and schema on save, so coordinate its use as described below.

## Service configuration

For a deliberately provisioned development environment, check these settings:

- Google Cloud has Maps SDK for Android and Maps SDK for iOS enabled with billing configured.
  Use separate restricted keys. The iOS key is restricted to the bundle IDs of every
  [build variant](#build-variants) it is built into and Maps SDK for iOS. The Android key is
  restricted to the matching packages, their signing certificate SHA-1s, and Maps SDK for
  Android. Obtain signing fingerprints through `bun x eas-cli credentials`; include each
  certificate used to sign an installed build. A wrong fingerprint can produce a gray map.
- Clerk's Native API and Convex integration are enabled. Under Native applications, register the
  Team ID and bundle ID of each variant that uses the instance, and allow its
  `<scheme>://sso-callback` redirect for Google sign-in. Preserve the integration's `aud` claim
  and map `"role": "{{user.public_metadata.role}}"` into the session token. For a development admin,
  set public metadata to `{ "role": "admin" }`, then sign out and back in to refresh the token.
- Convex's `CLERK_JWT_ISSUER_DOMAIN` matches that Clerk instance's Frontend API URL. Configure
  account-deletion credentials on the matching deployment when testing deletion, using the
  variables documented in [the environment inventory](production-environments.md).
- Configure the sign-in methods used by the app in Clerk: email code, password for reviewer
  accounts, Apple, and Google. Verify each enabled flow in the development build. Provider
  credentials belong in Clerk, not client env files.

The EAS owner and project ID are already tracked in `app.config.ts`. Log in with
`bun x eas-cli login` and check `bun x eas-cli project:info`; routine setup does not need `eas init`.
Cloud builds use EAS environment variables because local env files are ignored. Configure the
client variables and both Maps keys for the selected environment. Use plaintext visibility for
`EXPO_PUBLIC_*` values and sensitive visibility for Maps keys. Check the names with
`bun x eas-cli env:list --environment development`.

## Worktree development

T3 Code runs `bun run setup:worktree` automatically when it creates a worktree. For a worktree
created with Git directly, run it once yourself. Bash must be available on `PATH`; macOS and most
Linux distributions include it, while Windows users can use Git Bash or WSL.

```sh
bun run setup:worktree
```

Git does not record the original checkout path when a repository uses `--separate-git-dir`.
Provide it explicitly when running setup outside T3 Code:

```sh
T3CODE_PROJECT_ROOT=/path/to/primary-checkout bun run setup:worktree
```

The command links the primary checkout's `.env` and `.env.local` into the worktree, validates the
required variable names without printing their values, and runs `bun install --frozen-lockfile`.
It refuses to replace a local file or a link to another target. Environment changes made in the
primary checkout are visible through the links immediately.

Expo reloads changed `EXPO_PUBLIC_*` values from local env files. Reload the app to update its
JavaScript bundle. Google Maps keys live in the native binary, so changing either key requires a
new development build.

`.env` and `.env.local` stay on this machine. The setup command never downloads EAS variables or
writes secrets into tracked files. Cloud builds use the environment selected by the matching
profile in `eas.json`: `development`, `preview`, or `production`.

Run only one `convex dev` watcher against the shared development deployment. Stop the watcher in
the primary checkout before starting one from a worktree with backend changes. An installed
compatible development client can load JavaScript from any prepared worktree.

No teardown command is needed. Setup creates no external resource, and Git removes the links and
branch-local `node_modules` with the worktree.

## Build variants

Three builds can be installed on one iPhone at the same time. `src/lib/app-variants.ts` gives each
its own bundle ID, URL scheme, home-screen name, and icon. Every `eas.json` profile sets
`APP_VARIANT`. When it is unset, the config builds production.

| Variant | Profile | Bundle ID | Home screen | Backend |
| --- | --- | --- | --- | --- |
| Production | `production`, `production-test` | `com.yycskatespots.app` | YYC Skate Spots | Production |
| Preview | `preview` | `com.yycskatespots.app.preview` | YYC Preview, blue ribbon | Production |
| Development | `development` | `com.yycskatespots.app.dev` | YYC Dev, amber ribbon | Development |

Dev and preview builds show a small colored pill at the bottom of every screen naming the
variant and its data. Only production claims the share domain, so shared links always open the
store app. App Store releases and TestFlight builds share the production bundle ID, so a
TestFlight install replaces the App Store app until you reinstall it from the App Store.

Each new bundle ID needs one-time setup before its first build works end to end:

- In the Apple Developer portal, set Sign in with Apple on the variant's App ID to group with the
  primary `com.yycskatespots.app`. The shared Sign in with Apple key then works for account
  deletion, and an Apple user keeps the same Clerk account across variants on the same backend.
- Add the bundle ID to the iOS Maps key's application restrictions.
- Register the variant in the matching Clerk instance as described under service configuration.

`bun run start` runs Metro as the development variant, so the dev client receives matching
configuration. Install a preview build with `bun x eas-cli build --profile preview --platform ios`.
It uses the EAS `preview` environment, which needs the same variable names as production.

## Install a development build

An existing compatible development client can load this checkout's JavaScript. Rebuild after a
native dependency or configuration change. Both Maps keys and the share origin must be configured
in the EAS environment before building.

For iOS, register the device if needed and build:

```sh
bun x eas-cli device:create
bun x eas-cli build --profile development --platform ios
```

First delete any development build installed before variants existed. It uses the production
bundle ID and would be replaced by the App Store app. Install from the build's device-install
page. If iOS requests Developer Mode, enable it under Settings → Privacy & Security → Developer
Mode, restart, and confirm.

For Android:

```sh
bun x eas-cli build --profile development --platform android
```

Install the APK from the build URL. Check the signing certificate restriction in Google Cloud if
the map is gray. Android release work is currently deferred.

Start Metro with `bun run start` and open the development client on the same network. Run the
Convex watcher in a separate terminal when needed. The startup environment screen identifies
missing client configuration; a changed native Maps key requires a new build.

## Seed ownership

Seed commands require a Clerk identity so the resulting spots belong to a real account. Copy the
account's Clerk user ID and the exact Frontend API URL from the matching Clerk instance, then
target the deployment by name. The CLI derives the same `tokenIdentifier` that Convex receives from Clerk. Authorize that
identity on each deployment before running either command:

```sh
bun x convex env set SEED_OWNER_TOKEN_IDENTIFIER \
  'https://...clerk.accounts.dev|user_...' \
  --deployment '<development-deployment-name>'
```

For an empty deployment:

```sh
bun x convex run seed:run '{}' \
  --identity '{"subject":"user_...","issuer":"https://...clerk.accounts.dev","name":"Your Name"}' \
  --deployment '<development-deployment-name>'
```

For an existing deployment whose spots still belong to the old `seed` owner:

```sh
bun x convex run seed:claimSeededSpots '{}' \
  --identity '{"subject":"user_...","issuer":"https://...clerk.accounts.dev","name":"Your Name"}' \
  --deployment '<development-deployment-name>'
```

These examples target development explicitly. Production seeding or legacy ownership repair is a
separate, deliberate operation; it is not part of contributor setup. Use the Clerk instance and
owner identity that match the target deployment. The claim command is safe to repeat and never
changes spots created by another account.

## Native privacy checks

Run the release configuration check after changing the app config or a native dependency:

```sh
bun run verify:ios-release
```

It verifies the resolved privacy manifest, export-compliance flag, permission descriptions, bundle
identifier, Sign in with Apple entitlement, and Universal Link entitlement without printing
build-time credentials.

To inspect the generated native files after a native dependency update:

```sh
bun x expo prebuild --platform ios --no-install
```

Confirm `ios/YYCSkateSpots/PrivacyInfo.xcprivacy`, `Info.plist`, the app entitlements, and the Xcode
project's bundle identifier. The generated `ios/` directory is ignored and must not be committed.
EAS runs CocoaPods during the release build, when React Native aggregates the required-reason APIs
from linked SDK manifests. Check the final archive privacy report before upload and resolve any
processing warnings after upload. See the [iOS release runbook](ios-release-runbook.md).

## References

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
- [EAS CLI](https://docs.expo.dev/eas/cli/)
- [Clerk Convex integration](https://clerk.com/docs/guides/development/integrations/databases/convex)
