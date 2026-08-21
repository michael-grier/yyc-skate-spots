# YYC Skate Spots

A street skateboarding spot book for Calgary. Expo SDK 57 (React Native 0.86) + Expo Router,
Convex, Clerk, `react-native-maps`, NativeWind v4. Package manager is **Bun** (`bun.lock` is the
source of truth).

> **No Expo Go.** This app uses native modules (Google Maps, Clerk, SecureStore) that Expo Go
> does not ship. You run it in a custom **EAS development build** — a one-time build you install
> on your device, after which JS changes hot-reload exactly like Expo Go.

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
3. **Configure → JWT templates → New template → Convex.** Leave the name as `convex`. Note the
   **Issuer** domain (`https://<something>.clerk.accounts.dev`).
4. Copy the **Publishable key** into `.env` as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.

### 3. Convex

1. `bun x convex dev` — first run logs you in, creates the project, and prints the deployment
   URL. Put it in `.env` as `EXPO_PUBLIC_CONVEX_URL`. Photo uploads go to the deployment's
   HTTP-actions host, derived automatically for `*.convex.cloud` URLs; if you ever put Convex
   behind a custom domain, set that host as `EXPO_PUBLIC_CONVEX_SITE_URL` too.
2. In the Convex dashboard (or `bun x convex env set`), set
   `CLERK_JWT_ISSUER_DOMAIN` to the Issuer domain from step 2.3.
3. Leave `bun x convex dev` running while developing — it pushes functions/schema on save.

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

## Scripts

| Command             | What it does                              |
| ------------------- | ----------------------------------------- |
| `bun run start`     | Start the Metro dev server                |
| `bun run typecheck` | `tsc --noEmit`                            |
| `bun run lint`      | ESLint (`eslint-config-expo`)             |
| `bun run format`    | Biome (formatter only; ESLint owns lint)  |

## Architecture notes

- `app.config.ts` (not `app.json`) so native config can read env vars. Map keys are baked into
  binaries at **build** time; Convex/Clerk `EXPO_PUBLIC_*` vars are read by JS at **runtime**.
- `src/app/` is Expo Router's file-based routing directory — files become routes, like Next.js.
- Distance filtering is client-side haversine over one reactive Convex query — deliberate; the
  dataset is one city. Do not add a geospatial index.
- Rejected on purpose: `expo-maps` (alpha, no Google Maps on iOS), `@convex-dev/geospatial`,
  Expo Go.
