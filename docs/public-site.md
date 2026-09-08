# Public site

The site builder renders the privacy, support, standards, and share pages from `share-site/`.
The standards list comes from `src/lib/spot-standards.json`.

Build the static public site using the existing App Store record:

```sh
EXPO_PUBLIC_SHARE_BASE_URL='https://<share-domain>' \
APPLE_TEAM_ID=4A8Q8XX972 \
APP_STORE_ID=6807476193 \
bun run build:share-site
```

Deploy the contents of `dist-share/` at that exact origin. It includes the public privacy policy,
support page, spot standards, and share fallback. The host must serve
`/.well-known/apple-app-site-association` over HTTPS with `Content-Type: application/json`, without
authentication or a redirect. The generated `/share` page has the App Store prompt for recipients
who do not have the app. The build also generates Cloudflare Pages' `_headers` file so the
extensionless association file gets the required content type.

The published URLs are:

- `https://yycskatespots.com/privacy`
- `https://yycskatespots.com/support`
- `https://yycskatespots.com/standards`
- `https://yycskatespots.com/share?id=<spot-id>`

The audited iOS data flows and App Store Connect answer set are recorded in
[`ios-data-inventory.md`](ios-data-inventory.md).

## Cloudflare Pages configuration

For automatic Cloudflare Pages deployments, connect the GitHub repository and use:

- Production branch: `main`
- Framework preset: None
- Build command: `node scripts/build-share-site.mjs`
- Build output directory: `dist-share`
- Root directory: leave blank

Set `EXPO_PUBLIC_SHARE_BASE_URL`, `APPLE_TEAM_ID`, and `APP_STORE_ID` for both Production and
Preview in the Pages project's environment variables. Set `SKIP_DEPENDENCY_INSTALL=1` there too;
the static builder only uses Node's built-in modules, so installing the Expo app's dependencies
would waste build time. Pushes to `main` will deploy the production site, while other branches get
preview deployments.
