import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Generates the public files that bind the share website to the signed iOS app.
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = path.join(projectRoot, "dist-share");

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required to build the share site.`);
  }
  return value;
}

function parseShareOrigin(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new Error("EXPO_PUBLIC_SHARE_BASE_URL must be an HTTPS origin without a path.");
  }
  return url.origin;
}

const shareOrigin = parseShareOrigin(required("EXPO_PUBLIC_SHARE_BASE_URL"));
const appleTeamId = required("APPLE_TEAM_ID");
const appStoreId = required("APP_STORE_ID");

if (!/^[A-Z0-9]{10}$/.test(appleTeamId)) {
  throw new Error("APPLE_TEAM_ID must be the 10-character Apple Developer Team ID.");
}
if (!/^\d+$/.test(appStoreId)) {
  throw new Error("APP_STORE_ID must contain only the App Store's numeric app ID.");
}

const appStoreUrl = `https://apps.apple.com/app/id${appStoreId}`;
const template = await readFile(path.join(projectRoot, "share-site/index.template.html"), "utf8");
const html = template
  .replaceAll("{{SHARE_ORIGIN}}", shareOrigin)
  .replaceAll("{{APP_STORE_ID}}", appStoreId)
  .replaceAll("{{APP_STORE_URL}}", appStoreUrl);

const association = {
  applinks: {
    apps: [],
    details: [
      {
        appIDs: [`${appleTeamId}.com.yycskatespots.app`],
        components: [
          {
            "/": "/share",
            comment: "Opens a shared skate spot in YYC Skate Spots.",
          },
        ],
      },
    ],
  },
};

await mkdir(path.join(outputRoot, "share"), { recursive: true });
await mkdir(path.join(outputRoot, ".well-known"), { recursive: true });
await writeFile(path.join(outputRoot, "share/index.html"), html);
await writeFile(
  path.join(outputRoot, ".well-known/apple-app-site-association"),
  `${JSON.stringify(association, null, 2)}\n`,
);
// Cloudflare Pages otherwise infers a generic type for this extensionless file,
// but Apple requires it to be served as JSON for Universal Links.
await writeFile(
  path.join(outputRoot, "_headers"),
  "/.well-known/apple-app-site-association\n  Content-Type: application/json\n",
);
await copyFile(path.join(projectRoot, "assets/images/icon.png"), path.join(outputRoot, "icon.png"));

console.log(`Built the share site in ${outputRoot}`);
