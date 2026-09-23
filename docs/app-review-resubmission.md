# Guideline 2.1 response and resubmission

Apple requested six items in its information-needed message: a physical-device recording,
purpose/audience, access instructions, external services, regional differences, and any relevant
regulated-service or content-rights documentation. It asked for the information in both the reply
and App Review Information > Notes.

The owner confirmed on September 9, 2026 that the rejected build is **1.0.0 (5)** and that the
initial spot descriptions, photos, and branding are owned or used with permission. No additional
licensed content needs authorization documents. A new candidate recording is still outstanding. App Store
Connect has not been updated or resubmitted as part of preparing this document.

## Candidate preparation

The rejected submission used 1.0.0 (5). Prepare a replacement binary containing the merged
features and fixes for #90, #104, and #105. Keep the app version at 1.0.0 unless App Store Connect
requires otherwise; EAS assigns the next production build number. Do not reuse build 5.

TestFlight 1.0.0 (6) passed the owner's initial browsing and account checks on September 23, 2026,
using an iPhone 17 running iOS 26.6.2. It is being replaced to remove in-app password reset and fix
report sign-in continuation and error visibility, issues #107 and #108. Repeat the affected checks
on the replacement candidate; build 6 has not completed the full moderation/deletion walkthrough.

The owner confirmed the sign-in focus, recovery controls, and tab-reset behavior on the physical
iPhone using the development client and Metro. Development build
`9b09903a-8716-429e-a9b5-a58e9e84d62c` was internally distributed with the label 1.0.0 (5).
That label does not identify the rejected App Store binary or prove a new TestFlight candidate
has passed QA. SDK 57 patch alignment after this check also requires candidate device QA.

1. Review and merge the fixes and updated guidance into `main`.
2. Follow the [release runbook](ios-release-runbook.md) from a clean, current `main` checkout:
   verify configuration, deploy the matching production backend, build, and upload by EAS build ID.
3. Record the release commit, EAS build ID, TestFlight version/build, device/iOS, and test date.
4. Run the candidate checks below, then freeze that build and re-film all six sections of the
   [video script](app-review-video-script.md).

The old clips are rehearsal references. Do not mix them into a walkthrough presented as the
replacement build. App Store Connect has not been updated by preparing these documents.

## Before recording

- Install **1.0.0 ([BUILD NUMBER])**, the replacement candidate, from TestFlight on a physical iPhone running the latest publicly released
  iOS available when recording. Record the model, exact iOS version, and test date. Check Software
  Update rather than relying on a version number in this document.
- Confirm the TestFlight build matches the build selected in App Store Connect. Use the installed
  binary to verify every instruction and visible label. Recheck screenshots and privacy answers
  against this candidate, including display names and private report evidence.
- Verify the contributor and admin reviewer accounts still work using password sign-in. Do not
  assume the September 7 verification remains current. Keep those accounts available to Apple.
- Have a separate, disposable email address with inbox access for recording registration, the
  contribution ban, and deletion. Never delete or ban either reviewer account or your own admin.
- Have a photo you can share and details of a real Calgary feature for the spot submission.
  Publishing an approved demonstration spot affects the public production map. Use only content
  created for this walkthrough, and remove it when finished. Preserve existing listings.
- Test the flow once before recording. Resolve crashes, blank maps, failed logins, failed uploads,
  or incomplete deletions before describing device QA as complete.

Start iOS Screen Recording from Control Centre while on the Home Screen, then launch YYC Skate
Spots. Apple explicitly asks to see launch. Capture the real app without mock screens or a simulator.
Use Focus to avoid private notifications. Retrieve email codes on another device to keep unrelated
mail out of the recording. Narration is optional; short explanations of account switches help.

## Recording sequence

These are suggested scenes, not an Apple duration requirement. Keep successful actions and their
results visible. Record all applicable flows even if they take longer than expected.

| Scene | Actions to show | Evidence to leave visible |
| --- | --- | --- |
| Launch and browse | Launch from the Home Screen while signed out. Open a marker and its spot details. Show a photo if available, search, and change/reset a filter. Open directions, return, and open/dismiss the share sheet. | Calgary listings and useful detail without an account. Show browsing with location denied; demonstrate location/distance separately if granting it. |
| Register | Sign in > enter the unused disposable email > Continue > enter the received code > Verify. | Profile for the newly created account. Explain that the same email-code form registers new addresses and signs existing users in. |
| Save and submit | Save an existing spot with the heart and open Profile > Favourites. In Add spot, enter the real feature, location, your photo, notes, and bust factor. Save and accept the standards when prompted. Open Profile > Your spots. | Saved favourite, standards acceptance, and the pending submission. |
| Password login and approval | Sign out. Sign in to the admin reviewer account using Sign in with a password. Open Profile > Review spots > the new submission > Meets standards > Confirm. | Successful password login and the approved listing. Only approve accurate, appropriate content belonging to the demonstration. |
| Report | Sign out. Open the disposable account's approved listing > Report another problem, then sign in with the contributor reviewer account's password. Confirm the selected report opens automatically. Pick a reason and explain in details that this is an App Review demonstration, not a real complaint. Submit. | Sign-in continuation and report confirmation. The reporter must be a different account from the listing owner. |
| Review a report | Sign back in as admin. Profile > Review spots > Reported > the demonstration listing. Inspect the report, then use Meets standards to resolve the demonstration report. | Private report details and the moderation result. |
| Block contributions | Follow the preparation below, then show the third removal and Ban contributor, including confirmation. Sign back in to the disposable account. Open Profile and Add spot. | The administrator's ban result and the affected user's contribution restriction. |
| Delete account | While signed in as the disposable account, open Profile > Delete account and confirm. | Account deleted confirmation and the signed-out screen. Its demonstration spot and photo should disappear from the public map. |

Also test the offered Apple and Google sign-in paths in this build. Include them in the recording
if practical, especially any provider-specific failure or deletion prompt; email registration and
password login should remain clear. Do not use a personal account for a destructive deletion demo.

### Preparing the contribution-ban scene

The app exposes **Ban contributor** only after three administrator-confirmed removals. There is
no ordinary user's personal block button. Describe this accurately; the current Guideline 2.1
message does not establish whether Apple accepts this design under Guideline 1.2.

Use the disposable contributor from the registration scene. Through the app, create three clearly
labelled demonstration duplicates of its spot, leaving them pending and off the public map. As
admin, remove these three demonstration submissions with the duplicate-listing reason and an
internal note identifying the review demonstration. Show the third removal, select Ban contributor,
and confirm. The original approved demonstration spot can remain until account deletion.

The first two removals can be prepared before the ban scene; explain the existing count in the
recording. Use normal app actions against the candidate's production services. Do not enable development
fixtures in production or change database strike counts to fabricate evidence. Deleting the
disposable account at the end cleans up its remaining content and moderation record.

If this flow does not work in the candidate, record the failure and address it before submission. Do not
claim that a disabled ban button or a development-build demonstration proves blocking works in
the submitted app.

## Candidate device checks

Complete these on the replacement TestFlight build before recording. The development sign-in
checks are already confirmed, but they do not replace testing this production binary.

- [ ] First tap on the email field opens the keyboard, including after a cold launch.
- [ ] Wrong password and wrong/expired email code show an error with a usable Back to sign in.
- [ ] Switching to Map or Add spot resets the flow, clears errors/password/code, and keeps email.
- [ ] Opening Mail preserves code entry; Apple and Google sign-in return successfully.
- [ ] Password sign-in works for both reviewer accounts. Wrong-password/code errors are centered,
      become visible without manually closing the keyboard, and allow a retry.
- [ ] Signed-out Report dead spot and Report another problem open sign-in, then resume the selected
      report after authentication. Back cancels; signing in as the owner does not allow reporting.
- [ ] Registration, favourites, creation, editing, and current display-name labels work.
- [ ] Admin queue/detail labels identify contributors; unnamed legacy accounts have stable private labels.
- [ ] Approval publishes contributor content; admin-created content is immediately published.
- [ ] Photo permission can be declined, granted, and withdrawn. Admin photos require permission and
      an empty gallery, preserve spot details/review state, and notify the owner in Your spots.
- [ ] Reports reach admins. Dead-spot reports require 1–3 private evidence photos; resolving them
      removes the evidence, and dead-spot removal does not add a contributor strike.
- [ ] Three qualifying removals allow an admin ban, and the disposable account cannot contribute.
- [ ] Account deletion succeeds and removes its listings, photos, profile, and associated records.
- [ ] Maps, location denied/granted, directions, sharing, and policy/support links work.

Use disposable accounts and their own content for production QA. Never remove an unrelated spot
or change another user's moderation status to exercise these checks.

## Complete the response

Use the numbered text in [App Review notes](app-review-notes.md#notes-field) for all six answers.
Fill the video URL, device model, iOS version, test date, and admin credentials outside git. The
contributor credentials belong in App Store Connect's dedicated demo username/password fields.

Upload the recording to a reviewer-accessible location and verify playback while signed out.
Use a link that does not expire during review or require permission approval. Keep passwords,
unrelated personal data, and admin dashboards out of a publicly accessible video. App Review's
reply form also offers Attach File; use it if it accepts the recording. Keep a working video URL
in Notes for future reference, as Apple requested. Do not upload it as a public App Store preview.

After verifying all scenes and saving the updated Notes, prepend this introduction to the same
numbered text when replying to Apple:

```text
Hello App Review team,

Here is the requested information for YYC Skate Spots 1.0.0 ([BUILD NUMBER]), including a physical-iPhone walkthrough of that build. I have also added it to App Review Information > Notes.
```

Do not send the introduction until its statements are true. Check both fields' displayed character
limits after inserting the real URL and credentials. If the completed reply is too long, shorten
the wording while retaining all six answers and access instructions.

## Resubmit in App Store Connect

This resubmission includes app changes, so select the new tested binary from the
[release runbook](ios-release-runbook.md). Replace every build placeholder before replying.

1. Open YYC Skate Spots, app ID `6807476193`, in App Store Connect. Review the live rejection and
   status and any additional issues. Replace build 5 with the exact tested and recorded
   **1.0.0 ([BUILD NUMBER])** candidate.
2. Open the rejected version's App Review Information. Verify the contact and demo credentials,
   replace Notes with the completed six-part response, and save. Preserve Canada-only availability
   and the existing manual release option.
3. Open View App Review Issues & Messages > Resolve > Reply to App Review. Send the introduction
   and six answers with the working video link or attachment **before** resubmitting.
4. If the submission remains Unresolved Issues, use Edit on its rejected item, then Add for Review
   after saving the corrections. Return to the submission details and choose Resubmit to App Review.
   Follow the actual status and controls shown; do not remove the rejected item.
5. Verify App Store Connect reports the submission as Waiting for Review or In Review. Record the
   submission date, build, video reference, and observed status in the release record. A saved draft
   or Ready for Review status does not prove submission.

## Evidence still needed

- [ ] Physical iPhone model, latest iOS version, and test date recorded.
- [ ] Replacement TestFlight build passes the walkthrough, including deletion and contribution blocking.
- [ ] Both reviewer logins reverified and kept usable.
- [ ] Recording uploaded and accessible without permission requests.
- [ ] Notes saved and reply sent with all six answers and recording access.
- [ ] Resubmission confirmed by App Store Connect status.

## References

- [Reply to App Review messages and reuse a build for metadata issues](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/reply-to-app-review-messages/)
- [Edit and resubmit items with unresolved issues](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/manage-a-submission-with-unresolved-issues/)
- [Record the iPhone screen](https://support.apple.com/en-us/102653)
- [App Review Guideline 1.2, user-generated content](https://developer.apple.com/app-store/review/guidelines/#user-generated-content)
