# App Store screenshot plan

Status: Approved for capture

Target: iOS 1.0, English (Canada)

Last verified: September 6, 2026

## Deliverables

Create five portrait screenshots from the production TestFlight build. Capture on a supported
6.9-inch iPhone at one of Apple's accepted native sizes, preferably 1320 by 2868 pixels from an
iPhone 16 Pro Max. Export the final images as opaque PNGs with no alpha channel.

Store the files in `app-store/screenshots/en-CA/` once the copy and captures are approved. Keep the
raw, undecorated device captures beside the final exports so later versions can update the frames
without recreating the app state.

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

- Use build 1.0.0 (4) or its reviewed replacement against production services.
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
