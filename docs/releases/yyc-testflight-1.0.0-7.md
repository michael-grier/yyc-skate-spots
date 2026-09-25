# YYC Skate Spots 1.0.0 (7) candidate record

This records the candidate state on September 23, 2026. This candidate supersedes
[build 6](yyc-testflight-1.0.0-6.md).

Superseded on September 25, 2026. Device QA found that contributors without a saved display name
had blank public bylines and raw Clerk identifiers in the admin queue.
[Candidate 1.0.0 (8)](yyc-testflight-1.0.0-8.md) adds a display-name prompt and anonymous names. The results below remain a historical
record of build 7; do not record or submit it for App Review.

- Release commit: `d3c17ed3f278b8cef283b2225d897d31acc81a39`, merged PR #109.
- Build: `d49094f4-1072-496a-a226-8a1d5faa44c2`, production profile, store distribution, finished September 23, 2026.
- [EAS build](https://expo.dev/accounts/michaelgrier/projects/yyc-skate-spots/builds/d49094f4-1072-496a-a226-8a1d5faa44c2)
- Submission: `6da95f20-7d9c-4138-a514-55def880736f`.
- [EAS submission](https://expo.dev/accounts/michaelgrier/projects/yyc-skate-spots/submissions/6da95f20-7d9c-4138-a514-55def880736f)
- TestFlight upload and Apple processing: completed. Apple reports `VALID` and internal `IN_BETA_TESTING`.
- App Store Connect build ID: `e150d1f3-d487-4afd-b47f-45a800dcda54`.
- Assigned to the existing internal group `Release Candidate Testers`; membership verified. Automatic access to all builds remains off. No processing or compliance blocker reported.
- Physical-device QA: stopped September 25, 2026 by the display-name finding above.
- App Review: not resubmitted.

## Changes from build 6

- Removed in-app password reset. Reviewer password sign-in remains available; the operator manages reviewer passwords in Clerk.
- Signed-out reporting opens sign-in within the selected report route and continues to that report after authentication. Both dead-spot and other reports retain their destination.
- Sign-in errors appear centered above the form, dismiss the keyboard, and scroll into view. Inputs remain available for correction.
- Review notes and the recording script match these flows.

## Completed checks

The clean merged main checkout passed dependency installation, TypeScript, lint, 145 backend/unit tests, 120 UI tests, Expo Doctor's 21 checks, release configuration verification, and iOS export.

EAS account, project, production variable names, and production Convex variable names were verified. No test-fixture flag is enabled. The iOS Maps key restrictions were previously confirmed by the owner. Backend code and dependencies are unchanged from the deployed build 6 release, so no production backend redeployment was needed.

The finished archive identifies `com.yycskatespots.app`, version 1.0.0, build 7, and the merged release commit. The JavaScript references production Clerk and Convex. A native Maps key is present. Signed entitlements include the correct app identity, Sign in with Apple, and `applinks:yycskatespots.com`; debugging is disabled. Location, photo-library, and motion permission descriptions are present. Camera, microphone, Face ID, and always-on location descriptions are absent. Export compliance declares no non-exempt encryption.

All 14 bundled privacy manifests declare no tracking. The app privacy manifest matches the reviewed configuration, including the required-reason API categories and reasons.

## Device checks before recording

- [ ] Install build 7 and cold-launch the map; open a spot.
- [ ] Sign out, select Report dead spot, sign in, and confirm the same spot's dead-spot form opens with evidence photos required.
- [ ] Repeat using Report another problem and confirm the original spot remains selected.
- [ ] Back out of report sign-in; confirm a later sign-in does not unexpectedly open that report.
- [ ] Sign in as the selected spot's owner; confirm reporting is unavailable.
- [ ] Enter a wrong password and a wrong email code with the keyboard open. Confirm each error is centered, visible, and allows retry.
- [ ] Confirm reviewer password sign-in works and the password-reset control is gone.
- [ ] Recheck tab reset, opening Mail during code entry, Apple/Google sign-in, and registration.
- [ ] Complete the remaining contribution, moderation, permissions, sharing, and deletion checks in [the resubmission guide](../app-review-resubmission.md).

Use disposable accounts and content for destructive demonstrations. Build 6's reported device results do not establish that build 7 passes these checks.

## Privacy disclosure reconciliation

The same Google Maps manifest discrepancy found in build 6 remains in build 7. `GoogleMapsResources.bundle/GoogleMaps.bundle/PrivacyInfo.xcprivacy` declares Device ID as linked for Analytics and App Functionality, and Other Data Types as linked for Analytics. The separate GoogleMapsPrivacy bundle declares Device ID as unlinked.

Resolved on September 23, 2026. The SDK manifest in build 7 matches Google's published GoogleMaps 9.4.0 archive. The conflicting unlinked Device ID declaration comes from the react-native-maps wrapper's separate resource bundle. The corrected inventory includes the SDK's linked Device ID and linked Other Data Types declarations.

The owner signed in to App Store Connect, and the following corrections were published and verified after reloading the App Privacy page:

| Data type | Purposes | Linked | Tracking |
| --- | --- | --- | --- |
| Device ID | Analytics; App Functionality | Yes | No |
| Other Data Types | Analytics | Yes | No |

App Store Connect now lists 11 collected data types. The other nine answers remain unchanged. The product-page preview places Identifiers and Other Data under Data Linked to You, and only Diagnostics under Data Not Linked to You. No Data Used to Track You section appears.

The data inventory, release runbook, and public privacy-policy wording were merged in [PR #110](https://github.com/michael-grier/yyc-skate-spots/pull/110) as `2313aeb` on September 25, 2026, and the public privacy policy was published with a September 23 effective date. The App Store Connect corrections above were already published. These changes did not require a new app binary.
