# YYC Skate Spots 1.0.0 (9) candidate record

This records the candidate state on September 28, 2026. Recheck App Store Connect before acting.
This candidate supersedes [build 8](yyc-testflight-1.0.0-8.md).

- Release commit: `d4088a7a6a4c1e29d5fa75434f883e15d21c347f`, merged PRs #121 and #122.
- Build: `c880a052-0246-4f1b-a2ac-b17450a67dd1`, production profile, store distribution, finished September 28, 2026.
- [EAS build](https://expo.dev/accounts/michaelgrier/projects/yyc-skate-spots/builds/c880a052-0246-4f1b-a2ac-b17450a67dd1)
- Submission: `045fac1a-774f-4daa-a33c-4055717442da`.
- [EAS submission](https://expo.dev/accounts/michaelgrier/projects/yyc-skate-spots/submissions/045fac1a-774f-4daa-a33c-4055717442da)
- TestFlight upload and Apple processing: completed. Apple reports `VALID` and internal `IN_BETA_TESTING`.
- App Store Connect build ID: `a9942888-3bb5-4344-9281-c8e01450f8fa`.
- Assigned to the existing internal group `Release Candidate Testers`; membership verified. Automatic access to all builds remains off. No processing or compliance blocker reported.
- Physical-device QA: pending for build 9.
- App Review: not resubmitted.

## Changes from build 8

- Photo and location permission denials show an alert with Not now and Open Settings, for spot photos, report evidence, admin photos, the location picker, the map's locate button, and the distance filter.
- Report and admin-removal details stay above the keyboard (#113).
- The admin's Review spots card shows how many spots need review (#114).
- The admin photo request and the owner's permission note use the owner's wording (#115, #116).
- Dead-spot evidence photos appear uncropped in admin review and open full-screen (#117).
- Signing in as a different account resets the map (#118).
- The type chips accept the first tap while the keyboard is open (#119).
- Leaving the location step, or saving a moved pin, within 50 m of published spots or the contributor's own spots opens a Potential duplicate spot detected sheet. It links to each nearby spot and offers My spot is unique or Go back (#120).

## Completed checks

The clean merged main checkout passed dependency installation, TypeScript, lint, 148 backend/unit tests, 130 UI tests, Expo Doctor's 21 checks, release configuration verification, and iOS export.

EAS account, project, production variable names, and production Convex variable names were verified. No test-fixture flag is enabled. The production Convex backend was deployed from the release commit before the build; the dry run reported no index deletions. Build 8 remains compatible with this backend.

The finished archive identifies `com.yycskatespots.app`, version 1.0.0, build 9, and the release commit. The JavaScript references production Convex and a live Clerk key, and includes the permission alerts, review count, and duplicate-spot sheet. A native Maps key is present. Signed entitlements include the correct app identity, Sign in with Apple, and `applinks:yycskatespots.com`; debugging is disabled. Location, photo-library, and motion permission descriptions are present. Export compliance declares no non-exempt encryption.

All 14 bundled privacy manifests declare no tracking. Google Maps' resource manifest still declares Device ID and Other Data Types as linked, not used for tracking, matching the published App Privacy answers.

## Device checks before recording

- [ ] Install build 9 and cold-launch the map; open a spot.
- [ ] With photo access off, Add photos shows Photo access is off, and Open Settings opens the app's settings.
- [ ] With location access off, the locate button and Current location show Location access is off.
- [ ] Report details and admin removal notes stay visible while typing several lines.
- [ ] Admin review shows the review count, and dead-spot evidence photos appear whole.
- [ ] Signing in as a different account resets the map.
- [ ] A pin near an existing spot opens Potential duplicate spot detected; View opens the spot, and My spot is unique continues.
- [ ] Complete the remaining candidate checks in [the resubmission guide](../app-review-resubmission.md).

Use disposable accounts and content for destructive demonstrations. Build 8's device results do not establish that build 9 passes these checks.
