# App Review notes

Status: Draft pending demo-account setup

Target: iOS 1.0

Last verified: September 6, 2026

## App Store Connect fields

Enter the review contact's name, phone number, and monitored email address directly in App Store
Connect. Do not fill the demo username and password fields until the review sign-in method below is
resolved. Add the admin demo account to the notes field described below. Do not commit either
account's credentials.

The review contact must be able to answer App Review during the submission window. Both demo
accounts must use production services, avoid personal sign-in providers, and remain available until
the version is approved.

The shipped email flow uses a fresh one-time code, not a reusable password. A reviewer can create a
normal account with their own Apple, Google, or email identity, but that does not grant access to the
admin moderation screen. Issue #56 must settle a durable review-access method before submission;
the listing PR must not claim that an email password works in the current build.

## Notes field

Paste the following text into App Store Connect after replacing both bracketed account placeholders
with the credentials stored outside this repository.

```text
YYC Skate Spots is a public map of Calgary street skateboarding spots. An account is not required to browse the map or open spot details.

LOCATION
Location access is optional. If allowed, it shows the device's position, calculates distance to spots, and enables nearby filtering. The app remains usable if access is denied.

SIGN-IN AND CONTRIBUTOR FLOW
[DEMO SIGN-IN INSTRUCTIONS TO BE FINALIZED]
The contributor account can save favourites, submit a spot, manage its own spots, report a public listing, and delete itself from Account > Delete account.

USER-GENERATED CONTENT
New spots and changes to existing listings remain private to their contributor and administrators until an administrator approves them. Contributors must accept the public spot standards before their first submission. Every public spot has a private "Report this spot" action.

ADMIN MODERATION
[ADMIN DEMO SIGN-IN INSTRUCTIONS TO BE FINALIZED]

Sign in with the admin account, open Account > Review spots, and select the test submission. The review screen can approve it, remove it, inspect private reports, and manage contribution bans. Please leave the seeded public listings in place.

ACCOUNT DELETION
Account > Delete account permanently removes the account and its submitted spots, photos, favourites, reports, and moderation history. An Apple-authenticated account may receive Apple's confirmation prompt before deletion completes.

PUBLIC POLICIES AND SUPPORT
Privacy: https://yycskatespots.com/privacy
Support: https://yycskatespots.com/support
Spot standards: https://yycskatespots.com/standards
```

## Guideline 1.2: user-generated content

YYC Skate Spots holds every new spot and changed listing out of the public map, list, and spot
pages until an administrator marks it as meeting the spot standards. The contributor and
administrators can see the pending version while it is reviewed.

Before their first spot submission or listing change, contributors must accept the spot standards.
The app records the current policy version on their account, and the Convex backend rejects spot
and photo writes until that record exists. The standards prohibit explicit or harassing content,
spam, misleading listings, sensitive private locations, and photos the contributor cannot share.

Every public spot page has a "Report this spot" action. Reports are private, enter the admin review
queue, and include the selected reason and optional details. An administrator can approve the spot
or remove it. Confirmed removals count against the contributor. After three removals, an
administrator can block the account from creating spots, editing, uploading photos, and reporting.
The backend enforces the block even if someone calls the Convex functions directly.

Once review access is finalized, the reviewer can use the contributor and administrator demo
accounts entered in App Store Connect to verify submission, approval, reporting, removal, and
blocking. The privacy policy, support page, and community standards are available without an
account at https://yycskatespots.com/privacy, https://yycskatespots.com/support, and
https://yycskatespots.com/standards.
