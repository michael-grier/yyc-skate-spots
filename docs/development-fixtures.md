# Manual development fixtures

Replace `<development-deployment-name>` in every command with the shared development deployment
used by the app. Use that same target for setup and cleanup. Never enable fixtures on production.

## Contribution review

To test the first-contribution and proactive review flow with a regular development account:

1. Fill out the Add form and save. The community standards sheet must appear before any upload or
   submission starts.
2. Agree and submit. The new spot appears under **Profile → Your spots** as **Waiting for review**,
   but does not appear on the public map or list.
3. As an administrator, open **Profile → Review spots → New** and approve the spot. It should then
   appear publicly.
4. Edit the approved spot. The edited version becomes private again until an administrator
   approves it.

The acknowledgement is stored per development user. Use a fresh Clerk test user when repeating
the first step.

## Reported spot

Enable test fixtures on the development Convex deployment, then create a reported spot:

```sh
bun x convex env set TEST_FIXTURES_ENABLED true \
  --deployment '<development-deployment-name>'
bun x convex run seed:createModerationScenario \
  --deployment '<development-deployment-name>'
```

In the app, open **Profile → Review spots → Reported**, then open **Reported Test Spot**. Mark it
as meeting the standards, or remove it. The fixture contributor starts with two confirmed
removals, so removing the spot also exposes the third-strike ban flow.

The create command resets an earlier copy. Clear the scenario after testing, then disable test
fixtures:

```sh
bun x convex run seed:clearModerationScenario \
  --deployment '<development-deployment-name>'
bun x convex env remove TEST_FIXTURES_ENABLED \
  --deployment '<development-deployment-name>'
```

## Banned contributor

To test the banned contributor's experience, create a second user in the Clerk development
instance and leave its public metadata without an admin role. Copy that user's Clerk ID and use
the Frontend API URL from the Clerk Convex integration to run the fixture as that identity:

```sh
bun x convex env set TEST_FIXTURES_ENABLED true \
  --deployment '<development-deployment-name>'
bun x convex run seed:createBannedUserScenario --identity '{"subject":"<Clerk user ID>","issuer":"<Frontend API URL>","name":"Banned Workflow Test User"}' \
  --deployment '<development-deployment-name>'
```

Sign into the app as that user. The profile shows three private removal notices and a contribution
ban. The Add tab is blocked; editing **Banned User Test Spot**, uploading photos, and submitting
reports are rejected by the backend. Deleting the contributor's spot remains available. Other
signed-in users cannot open the removal notices.

Clear the fixture with the same identity after testing:

```sh
bun x convex run seed:clearBannedUserScenario --identity '{"subject":"<Clerk user ID>","issuer":"<Frontend API URL>","name":"Banned Workflow Test User"}' \
  --deployment '<development-deployment-name>'
bun x convex env remove TEST_FIXTURES_ENABLED \
  --deployment '<development-deployment-name>'
```

Keep `TEST_FIXTURES_ENABLED` unset on production deployments.
