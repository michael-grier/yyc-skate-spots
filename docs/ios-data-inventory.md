# iOS data inventory

Last verified: September 6, 2026

This is the source of truth for the version 1.0 privacy policy and the App Store Connect answers in
issue #56. It covers the production iOS app and the public site; Android is deferred. Re-check the final
release archive in #55 because a native SDK update can change its bundled privacy manifest.

## App data flows

| Data | Where it comes from | Leaves the device | Linked to an account | Purpose | Visibility, retention, and deletion |
| --- | --- | --- | --- | --- | --- |
| Email address | Email-code sign-in, Apple, or Google through Clerk | Yes: Clerk; delivered to Convex only as an authenticated token claim when present | Yes | Authentication, account display, contributor fallback name | Private. Clerk retains it while the account exists and deletes the user during in-app account deletion. Convex does not use email as the ownership key. |
| Name | Apple or Google profile data exposed by Clerk | Yes: Clerk and Convex | Yes | Profile display, public contributor byline, private admin label | The current Clerk name remains while the account exists. Convex snapshots the available name when a spot is submitted; it is public with an approved spot and does not automatically follow later profile changes. Deleted with the spot or account. |
| User and provider identifiers | Clerk user ID, Clerk token identifier, Apple/Google external-account identifier, session identifiers | Yes: Clerk, Convex, and the selected sign-in provider | Yes | Authentication, ownership, authorization, moderation, account deletion | Private except for the resulting contributor byline. Clerk and Convex identity records are deleted by in-app account deletion. A Clerk session token is encrypted locally with iOS SecureStore and cleared on sign-out or deletion. |
| Spot content | Name, types, bust factor, surface, notes, and coordinates entered by a contributor | Yes: Convex | Yes | Build and maintain the spot map | Pending content is visible only to its owner and administrators. Approved content and its contributor name are public until the owner deletes it, an administrator removes it, or the account is deleted. An admin removal keeps only an owner-visible notice; photos, coordinates, and notes are deleted. |
| Photos | Images selected from the photo library | Yes: Convex storage | Yes | Illustrate a submitted spot | Resized and re-encoded on the device before upload. Pending photos are private to the owner and administrators; approved photos are public. Removed when replaced, when the spot or account is deleted, or when an administrator removes the spot. Failed saves normally discard fresh uploads; any unattached remainder is removed with the uploader's account. |
| Favourites | A signed-in user's save/unsave actions | Yes: Convex | Yes | Sync a private saved-spots list | Private. Kept until unsaved, the spot is deleted, or the account is deleted. |
| Reports | Reported spot, selected reason, optional details, reporter identifier | Yes: Convex | Yes | Private review, safety, and abuse handling | Visible only to administrators. Deleted after the moderation decision, if the reported spot is deleted, or when the reporter deletes their account. Resolved removals retain only a count, not reporter identities. |
| Moderation and standards records | Standards acceptance, review decisions, confirmed removals, bans, administrator identifiers | Yes: Convex | Yes | Enforce the community standards and explain restrictions | Private to the affected user and administrators as applicable. A user's own records and removal notices are deleted with their account. If an administrator deletes their account, decisions about other users remain but the administrator identifier is removed. |
| Temporary Apple deletion token | A fresh Apple authorization code exchanged during account deletion | Yes: Apple and Convex | Yes | Revoke Sign in with Apple before deleting the account | Private. Removed immediately after successful revocation. An abandoned retry record expires within seven days. |
| Current precise location | iOS location permission and Core Location | Yes: the Google map SDK processes it; Convex receives it only when the user deliberately uses it as a submitted spot coordinate | A submitted spot coordinate is linked; ordinary map use is not linked by YYC Skate Spots | Blue dot, distances, nearby filtering, map centring, and optional spot placement | Held in app memory for the current session; YYC Skate Spots does not store location history. A submitted spot coordinate follows the spot-content rules above. |
| Map and SDK service data | Google Maps SDK requests and interactions | Yes: Google Maps Platform | Google's bundled manifest marks its service user ID as linked; device ID, product interaction, crash, and performance data are marked unlinked | Map functionality, service analytics, security, reliability, support, and capacity | Google's bundled privacy manifest declares no tracking. Google controls its service-log retention under its published policies. |
| Search and filter text | Map search and filters | No app-backend transmission | No | Filter the already-loaded spot list | Held in app memory only. Map camera interactions can still form part of Google Maps' unlinked product-interaction data. |
| Reverse-geocoded address | A spot coordinate sent through the iOS geocoder | Processed by Apple operating-system services | No app account linkage | Display a readable address for a spot | Held in memory for display; YYC Skate Spots does not write the result to Convex. |
| Directions request | Spot name and coordinates passed to Apple Maps or Google Maps after a tap | Yes: the maps app selected by the user | Governed by that maps app | Open turn-by-turn directions | YYC Skate Spots does not retain the request. |
| Shared spot link | Public spot identifier in `https://yycskatespots.com/share?id=…` | Yes: iOS share-sheet recipient and Cloudflare when opened in a browser | Link identifies a spot, not the sender | Open the spot in-app or show the static App Store fallback | The static fallback does not fetch the spot record. Cloudflare may retain ordinary web request logs under its policy. |
| Support email | Sender address, message, and optional attachments chosen in the user's email app | Yes: sender's mail provider and Cloudflare Email Routing | Linked to the sender address they use | Answer support, privacy, safety, and abuse requests | Routed to the app operator's mailbox and deleted when no longer needed to resolve or document the request. Earlier deletion can be requested at `support@yycskatespots.com`. |

## Providers in the shipped service

| Provider | Role | End-user data involved |
| --- | --- | --- |
| Clerk | Authentication, user profile, sessions, role claim | Email, name, sign-in method, user/provider identifiers, sessions, administrator role |
| Convex | Database, authenticated functions, and photo storage | User identifier, spot content, photos, favourites, reports, moderation, standards acceptance, temporary account-deletion state |
| Google Maps Platform | In-app Google map | Precise location for functionality; SDK-declared device ID, product interaction, crash, performance, and service user ID; request metadata including IP address, time, app, and SDK version |
| Apple | Sign in with Apple, Core Location/geocoder, SecureStore, Maps handoff, share sheet | Data chosen for Apple sign-in, current location and geocoding inputs, encrypted local session material, and data passed to Apple features at the user's request |
| Google Identity | Optional Google sign-in through Clerk | Google account identity and OAuth session data |
| Cloudflare | Static public pages and inbound support-email routing | Web request metadata and support messages |

Expo Application Services builds the binary but is not an end-user runtime data recipient in the
production app. The app includes no advertising SDK, independent analytics SDK, or crash-reporting
SDK. Google Maps' own SDK collection still needs to be disclosed.

## App Store Connect answer set

These are the intended answers for #56. Verify them against the archived app's merged privacy
manifest in #55 before publishing.

| Apple data type | Collected | Linked | Tracking | Purposes |
| --- | --- | --- | --- | --- |
| Contact Info → Name | Yes | Yes | No | App Functionality |
| Contact Info → Email Address | Yes | Yes | No | App Functionality |
| Location → Precise Location | Yes | Yes when saved as a submitted spot; otherwise unlinked | No | App Functionality |
| User Content → Photos or Videos | Yes | Yes | No | App Functionality |
| User Content → Other User Content | Yes | Yes | No | App Functionality |
| Identifiers → User ID | Yes | Yes | No | App Functionality; Analytics for the Google Maps service identifier |
| Identifiers → Device ID | Yes, by Google Maps SDK | No | No | App Functionality; Analytics |
| Usage Data → Product Interaction | Yes: linked favourites/standards activity and unlinked Google Maps interaction data | Yes | No | App Functionality; Analytics |
| Diagnostics → Crash Data | Yes, by Google Maps SDK | No | No | Analytics |
| Diagnostics → Performance Data | Yes, by Google Maps SDK | No | No | Analytics |

Overall tracking answer: **No**. Data is not used for third-party advertising, the developer's
advertising or marketing, or tracking across other companies' apps and websites.

## Evidence

- App schema and deletion: `convex/schema.ts`, `convex/accountDeletion.ts`
- Spot, report, and favourite lifecycles: `convex/spots.ts`, `convex/reports.ts`, `convex/favorites.ts`
- Location, maps, photos, and directions: `src/lib/use-user-location.ts`,
  `src/components/location-picker.tsx`, `src/lib/spot-photos.ts`, `src/lib/open-directions.ts`
- Authentication and local session storage: `src/components/sign-in-view.tsx`,
  `src/app/_layout.tsx`
- Installed SDK declarations:
  `node_modules/react-native-maps/ios/PrivacyInfo.xcprivacy` and
  `node_modules/react-native-maps/ios/AirGoogleMaps/Resources/GoogleMapsPrivacy.bundle/PrivacyInfo.xcprivacy`
- [Apple App Privacy reference](https://developer.apple.com/help/app-store-connect/reference/app-information/app-privacy)
- [Apple App Review Guidelines 5.1.1](https://developer.apple.com/app-store/review/guidelines/#privacy)
- [Google Maps Platform data collection, use, and retention](https://developers.google.com/maps/security/compliance/security-compliance#data-collection-usage-and-retention)
- [Google Maps SDK for iOS privacy guidance](https://developers.google.com/maps/documentation/ios-sdk/apple-privacy-policy)
