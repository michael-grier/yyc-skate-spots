# YYC Skate Spots 1.0.0 (6) candidate record

Superseded by [candidate 1.0.0 (7)](yyc-testflight-1.0.0-7.md) on September 23, 2026.
The results below remain a historical record of build 6; use the build 7 checklist for release work.

- Release commit: `2bdaec21092128329c276d643b88ec7bd696b685`, merged PR #106.
- Build: `b8e5d08d-6630-479c-87d7-4cb4a28e7087`, production profile, store distribution, finished September 21, 2026.
- [EAS build](https://expo.dev/accounts/michaelgrier/projects/yyc-skate-spots/builds/b8e5d08d-6630-479c-87d7-4cb4a28e7087)
- Submission: `7eadb3c9-7362-4ad0-9710-e26aa2910c9d`.
- [EAS submission](https://expo.dev/accounts/michaelgrier/projects/yyc-skate-spots/submissions/7eadb3c9-7362-4ad0-9710-e26aa2910c9d)
- Apple upload/processing: upload finished; Apple reports `VALID`, internal `IN_BETA_TESTING`, external `READY_FOR_BETA_SUBMISSION`. No processing/compliance blocker reported. Build 6 is assigned to the existing internal group `Release Candidate Testers`; assignment was verified through App Store Connect. Automatic access to all builds remains off.
- Physical-device QA: in progress. First browsing and sign-in recovery pass confirmed by the owner on September 23, 2026, using an iPhone 17 running iOS 26.6.2.
- App Review: not resubmitted.

## Completed checks

The clean merged main checkout passed dependency installation, TypeScript, lint, 145 backend/unit tests, 118 UI tests, Expo Doctor (21 checks), release configuration verification, and iOS export. The matching production Convex backend was deployed. The owner confirmed the iOS Maps key restrictions.

The finished IPA identifies `com.yycskatespots.app`, version 1.0.0, build 6. Its JavaScript references production Convex and Clerk. A native Maps key is present. Signed entitlements include Sign in with Apple and `applinks:yycskatespots.com`, with debugging disabled. Location, photo-library, and motion permission descriptions match the release configuration. Camera, microphone, Face ID, and always-on location descriptions are absent. Export compliance declares no non-exempt encryption.

All 14 bundled privacy manifests declare no tracking. The app-level required-reason API categories and reasons match the audited configuration.

## Physical-device QA results

Owner-reported results for TestFlight 1.0.0 (6), September 23, 2026, iPhone 17, iOS 26.6.2:

- [x] Cold launch loads the map and opens spot details.
- [x] First tap on the sign-in email field opens the keyboard.
- [x] The tested incorrect-password/code path displays an error and Back to sign in works. The checklist offered either path; separate coverage of both was not specified.
- [x] Switching from code entry to Map and back resets the flow, preserves the email, and clears the code.
- [x] Opening Mail and returning preserves code entry, and email-code sign-in succeeds.

Remaining candidate checks include the Add spot tab reset, any untested password/code error cases, Apple and Google sign-in, password reset, registration and profile changes, favourites, contribution and moderation flows, permissions, sharing, and deletion. Latest available iOS has not been independently verified.

## Privacy disclosure finding at build 6

This finding was resolved during build 7 preparation. See the
[build 7 reconciliation record](yyc-testflight-1.0.0-7.md#privacy-disclosure-reconciliation)
for the published corrections. The following records the original finding.

The archived Google Maps 9.4.0 SDK includes two privacy manifests with different declarations. The manifest at `Payload/YYCSkateSpots.app/GoogleMapsResources.bundle/GoogleMaps.bundle/PrivacyInfo.xcprivacy` declares:

| Data type | Linked | Tracking | Purposes |
| --- | --- | --- | --- |
| Device ID | Yes | No | Analytics; App Functionality |
| Other Data Types | Yes | No | Analytics |

At the time of this finding, the [data inventory](../ios-data-inventory.md) listed Device ID as unlinked and did not include Other Data Types. The maintained inventory and App Store Connect privacy answers needed reconciliation with the archived SDK declarations before App Review. This finding did not establish that device QA had passed.

## Planned next steps before this candidate was superseded

These steps are historical. Continue release work with [build 7](yyc-testflight-1.0.0-7.md).

1. Continue testing the installed TestFlight candidate 1.0.0 (6).
2. Complete the candidate device checklist in [the resubmission guide](../app-review-resubmission.md), using disposable accounts and their own content.
3. Append subsequent test outcomes to the device QA record above.
4. Reconcile the privacy disclosure finding above.
5. Re-film all six sections using this exact build, then update reviewer notes and resubmit.
