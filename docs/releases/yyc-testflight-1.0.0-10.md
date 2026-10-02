# YYC Skate Spots 1.0.0 (10) candidate record

This records the candidate state on September 29, 2026. Recheck App Store Connect before acting.
This candidate supersedes [build 9](yyc-testflight-1.0.0-9.md).

- Release commit: `1d8ace671aa4aac28df91fc19a1de9ae65d95f64`, merged PR #128.
- Build: `4d191873-6422-458f-8eb2-818203c4c405`, production profile, store distribution, finished September 29, 2026.
- [EAS build](https://expo.dev/accounts/michaelgrier/projects/yyc-skate-spots/builds/4d191873-6422-458f-8eb2-818203c4c405)
- Submission: `a2dc5fd2-d1c3-4d0d-9018-b04cf4646bb0`.
- [EAS submission](https://expo.dev/accounts/michaelgrier/projects/yyc-skate-spots/submissions/a2dc5fd2-d1c3-4d0d-9018-b04cf4646bb0)
- TestFlight upload and Apple processing: completed. Apple reports `VALID` and internal `IN_BETA_TESTING`.
- App Store Connect build ID: `a6f2bfb5-0492-4276-8eb0-18393f7bfeb9`.
- Assigned to the existing internal group `Release Candidate Testers`; membership verified. Automatic access to all builds remains off. No processing or compliance blocker reported.
- Physical-device QA: passed September 29, 2026 on an iPhone 17 running iOS 26.6.2. Both reviewer accounts have display names. Build 10 is frozen as the recording candidate.
- App Review recording: filmed on build 10 on September 29, 2026, edited with captions and privacy blurs, and uploaded as an unlisted YouTube video on October 2, 2026. The link is kept outside git.
- App Review: not resubmitted.

## Changes from build 9

- Tapping a map pin or cluster closes search, so the keyboard no longer covers the spot preview (#125).
- Transition is a spot type (#63). Types are listed alphabetically, with Other last.
- An admin's edits to their own spots stay published and reviewed by them; open reports still keep a spot in the queue (#124).
- Single-line text fields keep room for descenders and grow with accessibility text (#126).
- Type pills in the add form and filter sheet, and the distance pills, share an equal-width grid (#127).
- Expo SDK 57 patch versions were aligned, with one copy of `expo-constants`.

## Completed checks

The clean merged main checkout passed dependency installation, TypeScript, lint, 149 backend/unit tests, 130 UI tests, Expo Doctor's 21 checks, release configuration verification, and iOS export.

EAS account, project, production variable names, and production Convex variable names were verified. No test-fixture flag is enabled. The production Convex backend was deployed from the release commit before the build; the dry run reported no index deletions. Build 9 remains compatible with this backend.

The finished archive identifies `com.yycskatespots.app`, version 1.0.0, build 10, and the release commit. The JavaScript references production Convex and a live Clerk key, and includes the Transition type. A native Maps key is present. Signed entitlements include the correct app identity, Sign in with Apple, and `applinks:yycskatespots.com`; debugging is disabled. Location, photo-library, and motion permission descriptions are present. Export compliance declares no non-exempt encryption.

All 14 bundled privacy manifests declare no tracking. Google Maps' resource manifest still declares Device ID and Other Data Types as linked, not used for tracking, matching the published App Privacy answers.

## Device checks before recording

- [x] Install build 10 and cold-launch the map; open a spot.
- [x] Focus search, then tap a pin; the keyboard closes and the preview card opens on the first tap.
- [x] Add spot lists types alphabetically with Transition, Other last, and every pill the same width.
- [x] The filter sheet's type and distance pills line up in equal columns.
- [x] The email and spot name fields show descenders fully.
- [x] As admin, editing your own spot keeps it public and out of the review count.
- [x] Complete the remaining candidate checks in [the resubmission guide](../app-review-resubmission.md).

Use disposable accounts and content for destructive demonstrations. Build 9's device results do not establish that build 10 passes these checks.
