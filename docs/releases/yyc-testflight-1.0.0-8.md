# YYC Skate Spots 1.0.0 (8) candidate record

This records the candidate state on September 25, 2026. Recheck App Store Connect before acting.
This candidate supersedes [build 7](yyc-testflight-1.0.0-7.md).

- Release commit: `abc926d31f0a0b6b9e0d1c2da09307c6dbca3db0`, merged PR #111.
- Build: `2c8ed354-b4b6-48d4-b993-eff8c2c7f98e`, production profile, store distribution, finished September 25, 2026.
- [EAS build](https://expo.dev/accounts/michaelgrier/projects/yyc-skate-spots/builds/2c8ed354-b4b6-48d4-b993-eff8c2c7f98e)
- Submission: `868fa24a-4b2c-4450-812b-8829fde71e47`.
- [EAS submission](https://expo.dev/accounts/michaelgrier/projects/yyc-skate-spots/submissions/868fa24a-4b2c-4450-812b-8829fde71e47)
- TestFlight upload and Apple processing: completed. Apple reports `VALID` and internal `IN_BETA_TESTING`.
- App Store Connect build ID: `f55498c9-ca2b-4c1a-9ee0-4b55179d206c`.
- Assigned to the existing internal group `Release Candidate Testers`; membership verified. Automatic access to all builds remains off. No processing or compliance blocker reported.
- Physical-device QA: pending for build 8.
- App Review: not resubmitted.

## Changes from build 7

- Accounts without a saved display name show a stable "Anonymous Skater" name, derived from the account identifier, on public spot pages and in admin review. Production Clerk tokens carry no name or email claim, so build 7 showed blank bylines and raw Clerk identifiers.
- After first sign-in, a required sheet asks for a display name on any screen, including a sign-in that resumes a report. It suggests the Apple or Google name, offers the anonymous name, and offers Sign out if saving fails.
- The private email admin label was removed.
- Expo SDK 57 patch versions were aligned so Expo Doctor passes.

## Completed checks

The clean merged main checkout passed dependency installation, TypeScript, lint, 146 backend/unit tests, 121 UI tests, Expo Doctor's 21 checks, release configuration verification, and iOS export.

EAS account, project, production variable names, and production Convex variable names were verified. No test-fixture flag is enabled. The production Convex backend was deployed from the release commit before the build; the dry run reported no index deletions. Build 7 remains compatible with this backend.

The finished archive identifies `com.yycskatespots.app`, version 1.0.0, build 8, and the release commit. The JavaScript references production Convex and a live Clerk key, and includes the display-name prompt. A native Maps key is present. Signed entitlements include the correct app identity, Sign in with Apple, and `applinks:yycskatespots.com`; debugging is disabled. Location, photo-library, and motion permission descriptions are present. Export compliance declares no non-exempt encryption.

All 14 bundled privacy manifests declare no tracking. Google Maps' resource manifest still declares Device ID and Other Data Types as linked, not used for tracking, matching the published App Privacy answers.

## Device checks before recording

- [ ] Install build 8 and cold-launch the map; open a spot.
- [ ] Register a new email account. Confirm **Choose a display name** appears, the anonymous option fills in the name, and saving closes the sheet.
- [ ] Sign in with Apple and Google on unnamed accounts. Confirm the provider name is suggested.
- [ ] While signed out, start a report, sign in with an unnamed account, and confirm the name sheet appears before the report continues.
- [ ] Confirm unnamed contributors show the same anonymous name on the spot page and in admin review.
- [ ] Delete an account and confirm the name sheet does not appear during deletion.
- [ ] Complete the remaining candidate checks in [the resubmission guide](../app-review-resubmission.md).

Use disposable accounts and content for destructive demonstrations. Build 7's device results do not establish that build 8 passes these checks.
