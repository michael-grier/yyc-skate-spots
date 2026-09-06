# iOS TestFlight release runbook

This runbook creates a production iOS build and uploads that exact build to TestFlight. It does not
submit the app for App Review or release it publicly.

## 1. Prepare `main`

Release only a reviewed commit that has reached `origin/main`. Start in a checkout whose current
branch is `main`, then confirm that the checkout is clean and current:

```sh
git fetch origin
test "$(git branch --show-current)" = main
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
test -z "$(git status --porcelain)"
```

Record the commit for the release issue:

```sh
git rev-parse HEAD
```

Run the same checks as the pull request workflow:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run test
bun run test:ui -- --runInBand
bun x --no-install expo-doctor
bun run verify:ios-release
bun x expo export --platform ios
test -z "$(git status --porcelain)"
```

## 2. Check production configuration

Confirm the Expo account and project before spending a build:

```sh
bun x eas-cli whoami
bun x eas-cli project:info
bun x eas-cli env:list --environment production --format short
```

The EAS environment must list these five project variables:

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_CONVEX_URL`
- `EXPO_PUBLIC_SHARE_BASE_URL`
- `GOOGLE_MAPS_API_KEY_ANDROID`
- `GOOGLE_MAPS_API_KEY_IOS`

Do not add `--include-sensitive` when checking the list. Confirm in Google Cloud that the iOS Maps
key remains restricted to `com.yycskatespots.app` and Maps SDK for iOS.

Check the production Convex variable names without reading their values:

```sh
bun x convex env list --names-only --prod
```

The required names are `APPLE_SIGN_IN_KEY_ID`, `APPLE_SIGN_IN_PRIVATE_KEY`, `APPLE_TEAM_ID`,
`CLERK_JWT_ISSUER_DOMAIN`, and `CLERK_SECRET_KEY`. `TEST_FIXTURES_ENABLED` must not appear. See
[`production-environments.md`](production-environments.md) for ownership and rotation details.

## 3. Deploy Convex

Preview the production deployment first:

```sh
bun x convex deploy --dry-run
```

Confirm that Convex names the production deployment for this project and reports no unexpected
schema deletion. Then deploy the same reviewed commit:

```sh
bun x convex deploy --message "iOS 1.0.0 TestFlight"
```

The local Convex login authorizes this manual deployment. Do not create a deploy key unless this
step later moves into CI. A CI key should belong to the production deployment and grant only
`deployment:deploy`.

## 4. Build the store archive

Re-check the release boundary after the Convex command. Stop if `main` advanced or code generation
changed the working tree:

```sh
git fetch origin
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
test -z "$(git status --porcelain)"
```

The public version comes from `version` in `app.config.ts`. EAS owns the iOS build number because
`eas.json` uses `appVersionSource: "remote"` and `autoIncrement: true`. Check the current remote
number, but do not reset it:

```sh
bun x eas-cli build:version:get --platform ios --profile production
```

Create the archive without submitting it:

```sh
bun x eas-cli build \
  --platform ios \
  --profile production \
  --non-interactive \
  --freeze-credentials \
  --wait
```

`--freeze-credentials` prevents an unattended release from replacing signing credentials. If the
command says credentials are missing, stop and configure them interactively with
`bun x eas-cli credentials --platform ios`, then run the frozen build again.

Record the EAS build ID. Inspect it before upload:

```sh
bun x eas-cli build:view <build-id>
```

The build must be finished, use the `production` profile and environment, identify version 1.0.0,
and point to the recorded `main` commit. Build-number gaps are harmless. A failed build retry gets
a new number rather than reusing an archive identity.

## 5. Upload the selected build

Submit by build ID so a newer or unrelated archive cannot be selected by accident:

```sh
bun x eas-cli submit \
  --platform ios \
  --profile production \
  --id <build-id> \
  --non-interactive \
  --wait
```

Record the submission ID and monitor App Store Connect processing:

```sh
bun x eas-cli submit:view <submission-id>
bun x eas-cli submit:status --platform ios --profile production
```

The task is complete when Apple finishes processing the binary, reports no unresolved binary or
compliance error, and version 1.0.0 appears in TestFlight. App Store listing work, App Review
submission, and public release remain manual steps in later release tasks.

## Recovery

- If EAS Submit fails before Apple accepts the upload, run
  `bun x eas-cli submit:retry <submission-id>` or submit the same build ID again.
- If Apple rejects the binary during processing, fix the cause through a reviewed PR and create a
  new build. Apple will not accept a replacement archive with the same build number.
- Manage the App Store Connect API key through `bun x eas-cli credentials --platform ios`. Keep its
  private key in Apple or EAS, never in this repository or an issue.
- For a new public version, change `version` in `app.config.ts` through a PR. Keep remote build
  numbering enabled for TestFlight retries.

References: [Expo iOS submission](https://docs.expo.dev/submit/ios/),
[Expo app version management](https://docs.expo.dev/build-reference/app-versions/), and
[Convex production deploys](https://docs.convex.dev/cli/reference/deploy).
