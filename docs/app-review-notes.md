# App Review notes

Target: iOS 1.0

Historical verification: [version 1.0 release record](releases/1.0.md)

For the Guideline 2.1 information request, use the [recording and resubmission guide](app-review-resubmission.md).
The text below is a draft until the selected build, recording, account access, and content rights
have been verified. Repository checks do not establish that the submitted binary passed device QA.

## App Store Connect fields

Enter the review contact's name, phone number, and monitored email address directly in App Store
Connect. Put the contributor demo account in the demo username and password fields. Add the admin
demo account to the notes field described below. Do not commit either account's credentials.

## Reviewer account lifecycle

Verify both accounts in the selected release build before entering their credentials in App Store
Connect. These steps change production accounts and authentication settings; perform them as part
of the scheduled App Review submission.

The review contact must be able to answer App Review during the submission window. Both demo
accounts must use production services, avoid personal sign-in providers, and remain available
while the submission is under review.

Create both accounts directly in the production Clerk instance with distinct, non-personal email
addresses and strong passwords. Leave the contributor account without a role. Set the admin
account's public metadata to `{ "role": "admin" }`. Store both passwords in a password manager,
do not enrol either account in MFA, and keep the accounts active until Apple finishes its review.
Record the existing Clerk Device Trust setting before changing it. Keep Device Trust disabled
while the reviewer accounts are active so a sign-in from Apple's
device does not require access to either account's email inbox. Leave Clerk's lockout and user
enumeration protections enabled.

After approval, rejection, cancellation, or withdrawal ends the review, delete both reviewer
accounts and restore the recorded Clerk Device Trust setting. Create fresh accounts with new
passwords if a resubmission or future version needs review access.

## Notes field

Replace every bracketed placeholder, then paste the following text into the Notes field. Use the
same completed text in the reply to Apple, preceded by the short introduction in the resubmission
guide. Keep credentials outside this repository. Check the final character count in App Store
Connect after filling in the recording link and account details.

```text
1. PHYSICAL-DEVICE WALKTHROUGH
Recording: [REVIEWER-ACCESSIBLE VIDEO URL]
Device: [IPHONE MODEL]; iOS: [VERSION]; app: 1.0.0 (8); tested: [DATE].
Shows launch, main features, registration/login, reporting, moderation, contribution blocking, and deletion.

2. PURPOSE AND AUDIENCE
YYC Skate Spots helps skateboarders living in or visiting Calgary find and assess places to skate. Its searchable map has photos, feature types, surface notes, bust factor, and directions. Users can save favourites and contribute spots.

3. ACCESS AND MAIN FEATURES
Internet required; browsing needs no account or sample files. Map > marker > details shows photos, notes, directions, and sharing. Search/filter by type, bust factor, or distance. Location is optional; outside Calgary select Any distance.

Contributor demo: Sign in > enter the supplied email > Sign in with a password > enter supplied password > Sign in. A spot's heart saves it in Profile > Favourites. Add spot guides name, type, location, optional photos/notes, and bust factor; save and accept the standards. Find submissions in Profile > Your spots. After first sign-in, the app asks for a display name or an anonymous one; edit it on Profile.

Registration: Sign in > new email > Continue > emailed code > Verify. Apple/Google sign-in are also available. Back to sign in or switching app tabs resets the form, retaining email. Opening Mail preserves verification. Passwords for demo accounts are managed by the app operator.

Contributor submissions/edits stay private until admin approval. Report another user's spot via Report another problem > reason > Send report. Report dead spot requires 1–3 private evidence photos. Signed-out users see sign-in first, then continue directly to the selected report.

Admin demo email: [ADMIN DEMO EMAIL]
Admin demo password: [ADMIN DEMO PASSWORD]
Sign out, use admin password login > Profile > Review spots > select a spot. Meets standards approves; Remove spot requires a reason. Dead-spot removal adds no strike. After three other confirmed removals, Ban contributor blocks submissions, edits, uploads, and reports. Sign-in, browsing, and deletion remain available. Blocking is admin-managed; no personal block-user control or chat. Use disposable content for removal tests.

Photo assistance: submit without photos > Allow and save spot. Admins use Review spots > Needs photos to add photos with owner permission; pending spots stay pending. Owners can withdraw permission.

Deletion: Profile > Delete account > confirm. Removes the account, spots, photos, favourites, reports, and moderation history. Apple sign-in may require Apple confirmation. Use a disposable account.

All features are free. No purchases, subscriptions, paid content, advertisements, or payment processors.

4. EXTERNAL SERVICES
Clerk: authentication/sessions, including Apple/Google sign-in.
Convex: database, backend functions, photos, favourites, reports, moderation.
Google Maps Platform: in-app maps; optional directions handoff.
Apple: location/geocoding, secure session storage, sign-in, sharing, optional Maps directions.
Cloudflare: public website, policy/support pages, share-link fallback, support-email routing.
Expo/React Native: framework; EAS builds/distributes the binary. No AI services.

5. REGIONS
Canada-only distribution; listings cover Calgary and nearby areas. Features/content do not switch by region. Distance depends on location/filters. Calgary browsing works remotely without location permission.

6. REGULATED SERVICES AND CONTENT RIGHTS
No regulated services. I own or have permission to use the initial descriptions, photos, and branding. No other licensed content needs authorization documents. Contributors must have permission to share photos and follow the standards.

Privacy: https://yycskatespots.com/privacy
Support: https://yycskatespots.com/support
Standards: https://yycskatespots.com/standards
```

## Guideline 1.2: user-generated content

YYC Skate Spots holds ordinary contributors' new spots and changed listings out of the public map, list, and spot
pages until an administrator marks it as meeting the spot standards. The contributor and
administrators can see the pending version while it is reviewed.

Before their first spot submission or listing change, contributors must accept the spot standards.
The app records the current policy version on their account, and the Convex backend rejects spot
and photo writes until that record exists. The standards prohibit explicit or harassing content,
spam, misleading listings, sensitive private locations, and photos the contributor cannot share.

Public spot pages offer "Report dead spot" and "Report another problem" to users other than the
owner. Signed-out users sign in within the report route, then continue to their selected report.
Reports are private, enter the admin review
queue, and include the selected reason and optional details. Dead-spot reports additionally
require 1–3 private evidence photos. Evidence is deleted when the report is resolved, the spot
or reporter account is deleted, or an unattached upload expires after 24 hours. An administrator
can approve the spot or remove it. Dead-spot removal does not count against the contributor.
After three other removals, an administrator can block the account from creating spots,
editing, uploading photos, and reporting.
The backend enforces the block even if someone calls the Convex functions directly.

The reviewer can use the contributor and administrator demo accounts entered in App Store Connect
to verify submission, approval, reporting, removal, and blocking. The privacy policy, support page,
and community standards are available without an account at https://yycskatespots.com/privacy,
https://yycskatespots.com/support, and https://yycskatespots.com/standards.
