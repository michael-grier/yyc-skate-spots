# YYC Skate Spots

A street skateboarding spot book for Calgary. Expo SDK 57 (React Native 0.86) + Expo Router,
Convex, Clerk, `react-native-maps`, NativeWind v4. Package manager is **Bun** (`bun.lock` is the
source of truth).

> **No Expo Go.** This app uses native modules (Google Maps, Clerk, SecureStore) that Expo Go
> does not ship. You run it in a custom **EAS development build** — a one-time build you install
> on your device, after which JS changes hot-reload exactly like Expo Go.

## Pull request checks

Run the same checks as CI before opening a pull request:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run test
bun run test:ui -- --runInBand
bun x --no-install expo-doctor
bun x expo export --platform ios
```

These checks do not require production credentials or access to EAS, Clerk, Convex, Google, or
Apple accounts.

## Setup checklist (in order)

### 1. Google Maps API keys (GCP)

You need **two separate keys** in one GCP project, with **billing enabled**.

1. Create/pick a GCP project → enable **Maps SDK for Android** and **Maps SDK for iOS**.
   Enable only these two — the "enable all Maps APIs" shortcut turns on ~20 billable APIs this
   app never calls. Enabling the first one auto-creates an unrestricted key; adopt it as the
   Android key below rather than creating a third.
2. Create the **iOS key** first — it is the one you can fully restrict immediately:
   - Application restriction: **iOS apps** → bundle id `com.yycskatespots.app`.
   - API restriction: **Maps SDK for iOS** only.
3. The **Android key** needs a SHA-1 fingerprint, and GCP will not save the restriction without
   one. The signing key lives on EAS servers, so **do step 4 first**, then run
   `bun x eas-cli credentials` (Android → development → *Set up a new keystore*) to generate the
   keystore and print its SHA-1 — you do not need to wait for a build. Then:
   - Application restriction: **Android apps** → package `com.yycskatespots.app` + that SHA-1.
   - API restriction: **Maps SDK for Android** only.
   - Add one entry per signing key you ever use (EAS `development`, EAS `production`, and the
     local debug keystore if you run `expo run:android`).
   - Restriction changes take ~5 minutes to propagate.
4. `cp .env.example .env` and fill in both keys.
5. Set a budget alert (Billing → **Budgets & alerts**). Google has no hard spend cap.

An unrestricted key that leaks from a decompiled APK can be run up against your billing account
— restriction is not optional.

A missing or wrong SHA-1 does not fail the build. It renders a **gray grid instead of a map**,
with no error in Metro. Confirm with `adb logcat | grep -i "Google Maps Android API"`.

### 2. Clerk

1. Create an application at dashboard.clerk.com.
2. **Configure → Native applications**: make sure the **Native API** is enabled (required for
   any Expo integration).
3. **Configure → JWT templates → New template → Convex.** Leave the name as `convex`. Add
   `"role": "{{user.public_metadata.role}}"` to the template's existing claims, then note the
   **Issuer** domain (`https://<something>.clerk.accounts.dev`).
4. Copy the **Publishable key** into `.env` as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
5. In **Users**, open the account that should have moderation access and set its public metadata
   to `{ "role": "admin" }`. Sign out and back in after changing this so Clerk issues a new token.

### 3. Convex

1. `bun x convex dev` — first run logs you in, creates the project, and prints the deployment
   URL. Put it in `.env` as `EXPO_PUBLIC_CONVEX_URL`. Photo uploads go to the deployment's
   HTTP-actions host, derived automatically for `*.convex.cloud` URLs; if you ever put Convex
   behind a custom domain, set that host as `EXPO_PUBLIC_CONVEX_SITE_URL` too.
2. In the Convex dashboard (or `bun x convex env set`), set
   `CLERK_JWT_ISSUER_DOMAIN` to the Issuer domain from step 2.3.
3. Leave `bun x convex dev` running while developing — it pushes functions/schema on save.

#### Seed ownership

Seed commands require a Clerk identity so the resulting spots belong to a real account. Copy the
account's Clerk user ID and the exact Issuer domain from step 2.3, then target the deployment by
name. The CLI derives the same `tokenIdentifier` that Convex receives from Clerk. Authorize that
identity on each deployment before running either command:

```sh
bun x convex env set SEED_OWNER_TOKEN_IDENTIFIER \
  'https://...clerk.accounts.dev|user_...' \
  --deployment dev
```

For an empty deployment:

```sh
bun x convex run seed:run '{}' \
  --identity '{"subject":"user_...","issuer":"https://...clerk.accounts.dev","name":"Your Name"}' \
  --deployment dev
```

For an existing deployment whose spots still belong to the old `seed` owner:

```sh
bun x convex run seed:claimSeededSpots '{}' \
  --identity '{"subject":"user_...","issuer":"https://...clerk.accounts.dev","name":"Your Name"}' \
  --deployment dev
```

Run the applicable command again with `--deployment prod` after creating the production
deployment. If development and production use different Clerk applications, use the user ID and
Issuer from the matching application in both the environment variable and command. The claim
command is safe to repeat and never changes spots created by another account.

### 4. EAS project

1. `bun x eas-cli login` (create an Expo account if needed).
2. `bun x eas-cli init` — links this repo to an EAS project.

   **This command will fail**, and that is expected: it tries to write `extra.eas.projectId`
   into the app config, but this project uses a dynamic `app.config.ts` that EAS cannot rewrite.
   Copy the project ID it prints into `extra.eas` in `app.config.ts` by hand. Do not re-run
   `eas init` afterwards — it fails the same way every time. `bun x eas-cli project:info` is the
   check that matters.

   Expo may auto-create a `<username>s-team` organization at signup, in which case the project
   lands there rather than under your personal account. To move it: expo.dev → switch to that
   account → project → **Project settings → General → Transfer project** (you must be Owner or
   Admin on both). The project ID survives the transfer; the `@account/slug` URLs do not.

   Set the `owner` field in `app.config.ts` to the owning account. Without it EAS infers the
   account from login context, which is ambiguous when you own more than one and breaks in CI.
3. Mirror the two map keys into EAS env vars so cloud builds see them
   (`.env` is gitignored and never uploaded):
   ```sh
   bun x eas-cli env:create --environment development --name GOOGLE_MAPS_API_KEY_ANDROID --value <key>
   bun x eas-cli env:create --environment development --name GOOGLE_MAPS_API_KEY_IOS --value <key>
   ```
   Repeat for `preview`/`production` when you get there. The build **fails on purpose** if a key
   is missing (see `app.config.ts`). Verify with
   `bun x eas-cli env:list --environment development`.

Note: `eas` commands evaluate `app.config.ts` without loading `.env`, so they print
"GOOGLE_MAPS_API_KEY_… is not set" warnings even when your `.env` is correct. Harmless — cloud
builds read the EAS env vars above, not `.env`. To check what Expo actually resolves locally:
`bun x expo config --type public`.

### 5. Development build → device

After updating Expo or React Native packages, create a new development build. Restarting Metro
does not update the native modules inside an installed development client.

Before making an EAS build that includes spot sharing, set the public origin that will host the
fallback page and Universal Link association:

```sh
bun x eas-cli env:set --environment development --name EXPO_PUBLIC_SHARE_BASE_URL \
  --value https://<share-domain> --visibility plaintext
```

Repeat for `preview` and `production`. The value must be an HTTPS origin with no path, query,
fragment, credentials, or port. EAS builds fail if it is missing or malformed; local development
only prints a warning so the rest of the app can run while the public site is being set up.

Build the static fallback after the App Store record exists:

```sh
EXPO_PUBLIC_SHARE_BASE_URL=https://<share-domain> \
APPLE_TEAM_ID=4A8Q8XX972 \
APP_STORE_ID=6807476193 \
bun run build:share-site
```

Deploy the contents of `dist-share/` at that exact origin. The host must serve
`/.well-known/apple-app-site-association` over HTTPS with `Content-Type: application/json`, without
authentication or a redirect. The generated `/share` page has the App Store prompt for recipients
who do not have the app. The build also generates Cloudflare Pages' `_headers` file so the
extensionless association file gets the required content type.

For automatic Cloudflare Pages deployments, connect the GitHub repository and use:

- Production branch: `main`
- Framework preset: None
- Build command: `node scripts/build-share-site.mjs`
- Build output directory: `dist-share`
- Root directory: leave blank

Set `EXPO_PUBLIC_SHARE_BASE_URL`, `APPLE_TEAM_ID`, and `APP_STORE_ID` for both Production and
Preview in the Pages project's environment variables. Set `SKIP_DEPENDENCY_INSTALL=1` there too;
the static builder only uses Node's built-in modules, so installing the Expo app's dependencies
would waste build time. Pushes to `main` will deploy the production site, while other branches get
preview deployments.

Android (works from Linux):

```sh
bun x eas-cli build --profile development --platform android
```

When it finishes, open the build URL on your phone and install the APK. The keystore already
exists from step 1.3, so nothing to circle back to here — but if the map renders as a gray grid,
that step's SHA-1 restriction is what to re-check.

iOS requires an Apple Developer account; register your device first:

```sh
bun x eas-cli device:create
bun x eas-cli build --profile development --platform ios
```

The build finishes with a QR code in the terminal. Scan it with the iPhone Camera app to reach
the install page directly.

The first development build you install **will refuse to open**, with a "Developer Mode Required"
pop-up. iOS 16 and later require Developer Mode for any app signed with a development or ad-hoc
profile, which every internal-distribution build is. On the phone: **Settings → Privacy &
Security → Developer Mode**, toggle it on, restart when asked, then confirm at the prompt after
the reboot.

Once per device, not per build. The toggle only appears in Settings after a development-signed
app has been installed, so you cannot do it in advance.

### 6. Run

```sh
bun run start
```

Open the installed dev build on your phone (same Wi-Fi) and it connects to the dev server. If
anything in `.env` is missing the app shows a red "Environment not configured" screen listing
exactly what to fix.

### Moderation workflow fixture

To test the first-contribution and proactive review flow with a regular development account:

1. Fill out the Add form and save. The community standards sheet must appear before any upload or
   submission starts.
2. Agree and submit. The new spot appears under **Profile → Your spots** as **Waiting for review**,
   but does not appear on the public map or list.
3. As an administrator, open **Profile → Review spots → New** and approve the spot. It should then
   appear publicly.
4. Edit the approved spot. The edited version becomes private again until an administrator
   approves it.

The acknowledgement is stored per development user. Use a fresh Clerk test user when repeating
the first step.

Enable test fixtures on the development Convex deployment, then create a reported spot:

```sh
bun x convex env set TEST_FIXTURES_ENABLED true
bun x convex run seed:createModerationScenario
```

In the app, open **Profile → Review spots → Reported**, then open **Reported Test Spot**. Mark it
as meeting the standards, or remove it. The fixture contributor starts with two confirmed
removals, so removing the spot also exposes the third-strike ban flow.

The create command resets an earlier copy. Clear the scenario after testing, then disable test
fixtures:

```sh
bun x convex run seed:clearModerationScenario
bun x convex env remove TEST_FIXTURES_ENABLED
```

To test the banned contributor's experience, create a second user in the Clerk development
instance and leave its public metadata without an admin role. Copy that user's Clerk ID and use
the Issuer from the `convex` JWT template to run the fixture as that identity:

```sh
bun x convex run seed:createBannedUserScenario --identity '{"subject":"<Clerk user ID>","issuer":"<Clerk JWT issuer>","name":"Banned Workflow Test User"}'
```

Sign into the app as that user. The profile shows three private removal notices and a contribution
ban. The Add tab is blocked; editing **Banned User Test Spot**, uploading photos, and submitting
reports are rejected by the backend. Deleting the contributor's spot remains available. Other
signed-in users cannot open the removal notices.

Clear the fixture with the same identity after testing:

```sh
bun x convex run seed:clearBannedUserScenario --identity '{"subject":"<Clerk user ID>","issuer":"<Clerk JWT issuer>","name":"Banned Workflow Test User"}'
```

Keep `TEST_FIXTURES_ENABLED` unset on production deployments.

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
the primary checkout before starting one from a worktree with backend changes. Once setup finishes,
the usual development commands are:

```sh
bun x convex dev
bun run start
```

An installed development client can load JavaScript from any prepared worktree. Native
configuration changes still require a new development build. Check or start cloud development
builds with:

```sh
bun x eas-cli env:list --environment development
bun x eas-cli build --profile development --platform ios
bun x eas-cli build --profile development --platform android
```

No teardown command is needed. Setup creates no external resource, and Git removes the links and
branch-local `node_modules` with the worktree.

## Scripts

| Command                    | What it does                                      |
| -------------------------- | ------------------------------------------------- |
| `bun run start`            | Start the Metro dev server                        |
| `bun run setup:worktree`   | Prepare local env links and install dependencies  |
| `bun run typecheck`        | `tsc --noEmit`                                    |
| `bun run lint`             | ESLint (`eslint-config-expo`)                     |
| `bun run build:share-site` | Build the share fallback and AASA file            |
| `bun run format`           | Biome (formatter only; ESLint owns lint)          |

## Architecture notes

- `app.config.ts` (not `app.json`) so native config can read env vars. Map keys are baked into
  binaries at **build** time; Convex/Clerk `EXPO_PUBLIC_*` vars are read by JS at **runtime**.
- App icons are generated, not hand-drawn: `assets/brand/*.svg` are the sources, and each
  `assets/images/*.png` is `inkscape -w N -h N assets/brand/<name>.svg -o assets/images/<name>.png`
  at that PNG's existing size. Edit the SVG and re-render; never edit the PNG.
- `src/app/` is Expo Router's file-based routing directory — files become routes, like Next.js.
- Distance filtering is client-side haversine over one reactive Convex query — deliberate; the
  dataset is one city. Do not add a geospatial index.
- Rejected on purpose: `expo-maps` (alpha, no Google Maps on iOS), `@convex-dev/geospatial`,
  Expo Go.
