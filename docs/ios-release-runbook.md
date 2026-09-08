# iOS TestFlight release runbook

This runbook creates a production iOS build and uploads that exact build to TestFlight. It does not
submit the app for App Review or release it publicly.

## 1. Prepare `main`

Release only a reviewed commit that has reached `origin/main`. Start in a checkout whose current
branch is `main`. Open a fresh Bash shell with `bash` and keep that shell for the whole release. The
first command below makes any failed command stop the release shell. If it exits, restart at step 1
instead of resuming partway through the runbook.

Confirm that the checkout is clean and current:

```sh
set -euo pipefail
git fetch origin || {
  printf 'Release stopped: git fetch failed.\n' >&2
  exit 1
}
test "$(git branch --show-current)" = main || {
  printf 'Release stopped: current branch is not main.\n' >&2
  exit 1
}
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" || {
  printf 'Release stopped: main is not current with origin/main.\n' >&2
  exit 1
}
test -z "$(git status --porcelain)" || {
  printf 'Release stopped: the working tree is not clean.\n' >&2
  exit 1
}
```

Record the commit and read the user-facing version from the app config. Keep this shell variable for
the remaining commands:

```sh
git rev-parse HEAD
RELEASE_VERSION="$(bun -e 'import appConfig from "./app.config.ts"; console.log(appConfig({ config: {} }).version)')"
test -n "$RELEASE_VERSION" || {
  printf 'Release stopped: app.config.ts has no version.\n' >&2
  exit 1
}
printf 'Release version: %s\n' "$RELEASE_VERSION"
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
test -z "$(git status --porcelain)" || {
  printf 'Release stopped: the checks changed the working tree.\n' >&2
  exit 1
}
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

For a custom Convex domain, also require `EXPO_PUBLIC_CONVEX_SITE_URL` for photo uploads.

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
bun x convex deploy --dry-run || {
  printf 'Release stopped: the Convex dry run failed.\n' >&2
  exit 1
}
test -z "$(git status --porcelain)" || {
  printf 'Release stopped: the Convex dry run changed tracked files.\n' >&2
  exit 1
}
```

The dry run regenerates the tracked Convex bindings. The clean-tree check stops the release if that
produces an unreviewed change. Confirm that Convex names the production deployment for this project
and reports no unexpected schema deletion. Then deploy the same reviewed commit:

```sh
bun x convex deploy --message "iOS ${RELEASE_VERSION} TestFlight"
```

The local Convex login authorizes this manual deployment. Do not create a deploy key unless this
step later moves into CI. A CI key should belong to the production deployment and grant only
`deployment:deploy`.

## 4. Build the store archive

Re-check the release boundary after the Convex command. Stop if `main` advanced or code generation
changed the working tree:

```sh
git fetch origin || {
  printf 'Release stopped: git fetch failed.\n' >&2
  exit 1
}
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" || {
  printf 'Release stopped: main advanced after the release checks.\n' >&2
  exit 1
}
test -z "$(git status --porcelain)" || {
  printf 'Release stopped: the working tree changed after the release checks.\n' >&2
  exit 1
}
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

Record the EAS build ID. Compare the final archive privacy report with the
[data inventory](ios-data-inventory.md). Inspect the build before upload:

```sh
bun x eas-cli build:view <build-id>
```

The build must be finished, use the `production` profile and environment, identify the release
version printed in step 1, and point to the recorded `main` commit. Build-number gaps are harmless.
A failed build retry gets a new number rather than reusing an archive identity.

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

Resolve any upload or processing warnings. The TestFlight upload is complete when Apple finishes
processing the binary, reports no unresolved binary or compliance error, and the release version
printed in step 1 appears in TestFlight. App Store listing
changes, App Review submission, and public release are separate manual operations. Use the
[listing](app-store-listing.md) and [reviewer notes](app-review-notes.md) when preparing App Review.

## Recovery

- If `bun x eas-cli submit:view <submission-id>` reports a failed, retryable submission, run
  `bun x eas-cli submit:retry <submission-id>`.
- If the submission is active or its state is unknown, do not resubmit the build. Continue
  monitoring the existing submission.
- If Apple rejects the binary during processing, fix the cause through a reviewed PR and create a
  new build. Apple will not accept a replacement archive with the same build number.
- Manage the App Store Connect API key through `bun x eas-cli credentials --platform ios`. Keep its
  private key in Apple or EAS, never in this repository or an issue.
- For a new public version, change `version` in `app.config.ts` through a PR. Keep remote build
  numbering enabled for TestFlight retries.

References: [Expo iOS submission](https://docs.expo.dev/submit/ios/),
[Expo app version management](https://docs.expo.dev/build-reference/app-versions/), and
[Convex production deploys](https://docs.convex.dev/cli/reference/deploy).
