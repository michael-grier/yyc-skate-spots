# App Review video script

Record the six numbered sections as separate clips, in order. You can stop recording between
sections and join the clips afterward. Narration is optional; the quoted lines explain what Apple
is seeing. Pause briefly after each action so the result is readable. Keep each important action
and its result together in the recording.

## Before recording

Record the **new production TestFlight candidate**, after its fixes reach `main` and it passes
device QA. Fill in `[BUILD NUMBER]` from TestFlight; do not assume the next number. The rejected
1.0.0 (5) and the development client also labelled 1.0.0 (5) are not the recording target.
Use the same candidate for every clip and select that build in App Store Connect.

Use your physical iPhone 17 with the latest public iOS available to it. The previous script listed
iOS 26.6.2; recheck Settings > General > Software Update and replace `[IOS VERSION]` before filming.
Start signed out. Have these ready:

- A new disposable email address for registration, submissions, blocking, and deletion.
- The contributor reviewer account for reporting another user's content.
- The administrator reviewer account for moderation.
- Photos you own and accurate details of a real Calgary spot.
- If showing admin photo assistance, a second distinct, accurate spot with no photos yet.

Keep reviewer passwords masked and retrieve email codes on another device. **Only delete or ban
the disposable account.**

## 1. Launch, browsing, filters, directions, and sharing

**Clip:** `01-browsing.MP4`  
**Starting account:** Signed out.

### Launch and explain the app

Start screen recording on the iPhone Home Screen, then tap YYC Skate Spots.

> This is YYC Skate Spots version 1.0.0, build [BUILD NUMBER], running on a physical iPhone 17
> with iOS [IOS VERSION]. It helps skateboarders find and share skate spots in Calgary.

Let the map finish loading.

### Browse without an account

Pan and zoom the map. Tap a marker and open its details. Show the available photos, feature types,
surface information, bust factor, and notes.

> Browsing does not require an account. Spot details help users assess a location before visiting.

Search for an existing spot. Apply a type or bust-factor filter, show the results, then reset it.

### Show location, directions, and sharing

Open a spot's directions action, show the maps app opening, then return. Open and dismiss the share
sheet without sending anything.

> Location access is optional. It enables position and distance features. Users can also open
> directions or share a spot link.

Stop recording after returning to the app. Remain signed out for the next clip.

## 2. Registration, favourites, and spot submission

**Clip:** `02-registration-and-submission.MP4`  
**Starting account:** Signed out; register the disposable account in this clip.

### Register a new account

Open **Sign in**. Enter the unused disposable email address, tap **Continue**, enter the emailed
code, and tap **Verify**.

> A new user registers by verifying their email address. Existing users can also sign in with
> email codes. Apple and Google sign-in are available.

### Choose a display name

Profile opens with **Choose a display name**. Show the **Use Anonymous Skater …** option, then
enter a non-personal demonstration name, tap **Save name**, and leave the updated Profile visible.
Use this name to identify the account's submissions later in the admin queue.

> New accounts choose the name shown beside their spots. They can use an anonymous name instead,
> and change it later on Profile.

### Save a favourite

Return to the map, open an existing spot, and tap its heart. Open **Profile → Favourites** and show
the saved spot.

> Signed-in users can save spots to their favourites.

### Submit and edit a spot

Using the disposable account, open **Add spot**. Follow its steps to enter an accurate name,
feature type, location, your photo, notes, and bust factor. Save and show the community standards
prompt. Read and accept it.

Open **Profile → Your spots** and show the pending submission. Open its editing action, change a
note, save, and show the updated submission.

> Contributors accept the spot standards before submitting. Their submissions and edits remain
> private until an administrator approves them.

### Show optional admin photo permission

For the second distinct spot, submit without photos. At **No photos yet. Can the admin help?**,
show both choices and choose **Allow and save spot**. Leave this second spot pending. In clip 3,
the admin can add a photo while the spot stays pending. This extra spot is deleted with the
same disposable account in clip 6.

> Photo assistance is optional. Contributors can permit an administrator to add photos to an
> empty gallery and can withdraw that permission from their spot.

If you have no second accurate spot to submit, omit this demonstration and cover consent during
candidate QA. Do not submit invented coordinates or alter an existing person's listing.

### Optional sign-in demonstrations

If practical, also capture successful **Continue with Apple** and **Continue with Google** sign-ins.
Sign out between providers; don't delete a personal account to demonstrate those options. Return
to the disposable account using its email code afterward.

### Show sign-in recovery without changing reviewer credentials

During a signed-out interval, show **Sign in with a password** and **Back to sign in**.
Switch to Map, then return to Sign in to show the base screen with
the email preserved. Return to the disposable account with its email code.

> Leaving the sign-in tab starts a fresh attempt. Opening Mail to retrieve a code keeps the
> verification screen available.

Reviewer passwords are managed in Clerk by the app operator. There is no in-app password reset.

Stop recording with the original submission still pending.

### Setup between clips 2 and 3

For the later blocking demonstration, also create three clearly labelled demonstration duplicates
of this spot using the disposable account. Leave those duplicates pending. They should never be
approved or appear on the public map. This repetitive setup can happen between recordings. Remain
signed in to the disposable account for the start of clip 3.

## 3. Administrator login and approval

**Clip:** `03-admin-login-and-approval.MP4`  
**Starting account:** Disposable contributor; switch to administrator on camera.

Sign out. Enter the administrator reviewer email, select **Sign in with a password**, enter its
password, and sign in.

Open **Profile → Review spots**. Show the disposable account's display name next to its
submission. Select the original, accurate submission, inspect it, then select
**Meets standards → Confirm**. Show it on the public map.

> Administrators review submitted content before publication. This is the same password sign-in
> method available to the supplied reviewer accounts.

Approving this spot makes it public temporarily. Preserve existing listings throughout the
demonstration.

If you granted photo permission in clip 2, open **Review spots → Needs photos**, select the
second spot, and open its photo action. Select a photo you own of that feature and tap
**Publish photos**. Show that the photos were added and the spot still awaits approval. Leave it
pending; admin photo assistance does not approve a contributor's submission.

Stop recording after showing the results. Remain signed in as administrator.

## 4. Reporting and moderation

**Clip:** `04-reporting-and-moderation.MP4`  
**Starting account:** Administrator; switch to the contributor reviewer account to report.

### Report content from another account

Sign out. Open the disposable account's approved spot, then **Report another problem**.
Use password sign-in for the contributor reviewer account and show that the selected report
opens automatically after sign-in.

Briefly select **Dead spot** to show the requirement for 1–3 evidence photos. Do not submit a false dead-spot
claim. Switch to **Something else** and enter:

> App Review workflow demonstration using our disposable account's listing. This is not a
> complaint about another contributor.

Submit and leave the report confirmation visible.

> Users can report another contributor's listing. Reports are private and go to administrators.

### Review and resolve the report

Sign back in as administrator. Open **Profile → Review spots → Reported**, then the demonstration
listing.

Show its report details. Select **Meets standards** and confirm to resolve the demonstration report.

> Administrators can inspect reports and decide whether a listing meets the standards or should
> be removed. Dead-spot evidence stays private; removing a dead spot adds no contributor strike.

Stop recording after resolving the report. Remain signed in as administrator.

## 5. Contribution blocking and the blocked account's experience

**Clip:** `05-contribution-blocking.MP4`  
**Starting account:** Administrator; the three demonstration duplicates are still pending.

### Remove content and block contributions

> These three pending duplicates were created with the disposable account between recordings
> to demonstrate removal and contribution blocking. They have not been published.

Still as administrator, open each of the three pending demonstration duplicates. Select
**Remove spot**, choose **Duplicate or inaccurate**, add a note identifying the demonstration, and
confirm.

Show the confirmed-removal count. After the third removal, select **Ban contributor** and confirm.
Leave the result visible.

> After three confirmed removals, an administrator can ban further contributions. This blocks
> submissions, edits, photo uploads, and reports.

The app's blocking mechanism is administrator-managed. Don't describe it as a personal block-user
button.

### Show the blocked account's experience

Sign out, then sign back into the disposable account using its email code.

Show the restriction on **Profile**, then open **Add spot** to demonstrate that contribution access
is blocked. Return to the map and show browsing still works.

> The restricted account can still sign in, browse, and delete its account, but cannot contribute.

Stop recording while signed in to the disposable account. Keep that account for the final clip.

## 6. Account deletion

**Clip:** `06-account-deletion.MP4`  
**Starting account:** Disposable contributor, now blocked from contributing.

On the disposable account, open **Profile → Delete account**, then confirm **Delete account**.

Leave the success confirmation visible, dismiss it, and show the signed-out screen. Return to the
map and verify that its approved demonstration spot has disappeared.

> Users can permanently delete their account inside the app. Deletion removes their submitted
> spots, photos, favourites, reports, and moderation history.

End with:

> All features are free. The app has no purchases, subscriptions, or paid content.

Stop recording. Keep all six original clips for editing.

## Final recording check

Use the installed candidate's controls and verify every action before narrating success. Keep
all six clips from that same TestFlight build. The earlier build-5 browsing, registration, and
supplement clips are rehearsal references; re-film them for this candidate.

Join clips in order with brief section titles if useful. Trim idle waits between actions, while
keeping each action and its result visible. Obscure suggested contacts in the share sheet,
unrelated gallery thumbnails, notifications, email codes, and any exposed passwords. Check audio
for private information too. Review the whole export before uploading it, then verify playback
from a signed-out browser. Follow the [resubmission checklist](app-review-resubmission.md).
