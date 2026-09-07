# App Store screenshot plan

Status: Captured and approved

Target: iOS 1.0, English (Canada)

Last verified: September 7, 2026

## Deliverables

The five portrait screenshots were captured from production TestFlight build 1.0.0 (5) on an
iPhone 17. Final exports in `app-store/screenshots/en-CA/` use Apple's accepted 1320 by 2868 pixel
size and are opaque PNGs without alpha channels.

The 1206 by 2622 pixel device captures are preserved in the adjacent `raw/` directory so later
versions can update the presentation without recreating the app state. The profile source has its
account and moderation header masked so the repository does not retain personal information.

## Sequence and copy

### 01-map.png

Headline:

```text
Calgary's spot book
```

Supporting line:

```text
Plan your next session with local knowledge.
```

Show the main map at a useful Calgary zoom with several approved spot markers and one selected spot
preview. Do not show the location-permission prompt.

### 02-search.png

Headline:

```text
Find what you want to skate
```

Supporting line:

```text
Search and filter by spot type, distance, and bust factor.
```

Show a real search or filter result with enough map context to make the feature obvious.

### 03-details.png

Headline:

```text
Local details that matter
```

Supporting line:

```text
Check photos, surfaces, bust factor, and directions.
```

Show an approved spot with a strong landscape photo and populated details. Use a listing whose
contributor name and notes are suitable for a public product page.

### 04-favourites.png

Headline:

```text
Keep a session list
```

Supporting line:

```text
Save favourite spots across your devices.
```

Show the signed-in Favourites list with at least three approved spots. Use a dedicated screenshot
account rather than a personal profile.

### 05-contribute.png

Headline:

```text
Add the spots only locals know
```

Supporting line:

```text
Submit photos and details for review.
```

Show the add flow with realistic, non-sensitive draft content. Do not submit the screenshot fixture
to production.

## Capture rules

- Use production TestFlight build 1.0.0 (5).
- Use real approved Calgary spots. Do not expose pending reports, moderation details, email
  addresses, credentials, notifications, or personal account information.
- Keep the status bar clean and consistent. Use full cellular or Wi-Fi signal and a sensible time.
- Do not show permission dialogs, keyboard suggestions, debug overlays, test labels, or the
  development-client menu.
- Keep the shipped app UI legible. Decorative framing and captions must not imply features the app
  does not provide.
- Check every export at full size for accidental transparency, scaling blur, clipped text, and stale
  app data before upload.

Apple permits one to ten screenshots and scales the highest-resolution set down when the interface
is the same across device sizes. If the chosen phone does not produce an accepted 6.9-inch size,
capture again on a listed device rather than stretching the image.

Reference: [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
