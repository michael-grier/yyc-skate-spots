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
2. Create the **Android key**:
   - Application restriction: **Android apps** → add package `com.yycskatespots.app` plus your
     SHA-1 fingerprint. For EAS builds the signing key lives on EAS servers — get the SHA-1 with
     `eas credentials` (Android → Keystore) after step 5, then come back and add it.
   - API restriction: **Maps SDK for Android** only.
3. Create the **iOS key**:
   - Application restriction: **iOS apps** → bundle id `com.yycskatespots.app`.
   - API restriction: **Maps SDK for iOS** only.
4. `cp .env.example .env` and fill in both keys.

An unrestricted key that leaks from a decompiled APK can be run up against your billing account
— restriction is not optional.

### 2. Clerk

1. Create an application at dashboard.clerk.com.
2. **Configure → Native applications**: make sure the **Native API** is enabled (required for
   any Expo integration).
3. **Configure → JWT templates → New template → Convex.** Leave the name as `convex`. Note the
   **Issuer** domain (`https://<something>.clerk.accounts.dev`).
4. Copy the **Publishable key** into `.env` as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.

### 3. Convex

1. `bun x convex dev` — first run logs you in, creates the project, and prints the deployment
   URL. Put it in `.env` as `EXPO_PUBLIC_CONVEX_URL`.
2. In the Convex dashboard (or `bun x convex env set`), set
   `CLERK_JWT_ISSUER_DOMAIN` to the Issuer domain from step 2.3.
3. Leave `bun x convex dev` running while developing — it pushes functions/schema on save.

### 4. EAS project

1. `bun x eas-cli login` (create an Expo account if needed).
2. `bun x eas-cli init` — links this repo to an EAS project.
3. Mirror the two map keys into EAS env vars so cloud builds see them
   (`.env` is gitignored and never uploaded):
   ```sh
   bun x eas-cli env:create --environment development --name GOOGLE_MAPS_API_KEY_ANDROID --value <key>
   bun x eas-cli env:create --environment development --name GOOGLE_MAPS_API_KEY_IOS --value <key>
   ```
   Repeat for `preview`/`production` when you get there. The build **fails on purpose** if a key
   is missing (see `app.config.ts`).

### 5. Development build → device

Android (works from Linux):

```sh
bun x eas-cli build --profile development --platform android
```

When it finishes, open the build URL on your phone and install the APK. Now grab the keystore
SHA-1 (`bun x eas-cli credentials`) and finish the Android key restriction from step 1.

iOS requires an Apple Developer account; register your device first:

```sh
bun x eas-cli device:create
bun x eas-cli build --profile development --platform ios
```

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
