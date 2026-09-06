import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Generates the public pages and binds /share to the signed iOS app.
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = process.env.SHARE_SITE_OUTPUT_DIR
  ? path.resolve(process.env.SHARE_SITE_OUTPUT_DIR)
  : path.join(projectRoot, "dist-share");
const sourceRoot = path.join(projectRoot, "share-site");
const supportEmail = "support@yycskatespots.com";

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
const template = await readFile(path.join(sourceRoot, "page.template.html"), "utf8");
const spotStandards = JSON.parse(
  await readFile(path.join(projectRoot, "src/lib/spot-standards.json"), "utf8"),
);

function interpolate(source, replacements) {
  const rendered = Object.entries(replacements).reduce(
    (result, [name, value]) => result.replaceAll(`{{${name}}}`, value),
    source,
  );
  const unresolved = rendered.match(/{{[A-Z0-9_]+}}/g);
  if (unresolved) {
    throw new Error(
      `Unresolved share-site template values: ${[...new Set(unresolved)].join(", ")}`,
    );
  }
  return rendered;
}

function renderStandards() {
  return spotStandards
    .map(({ title, description }) => `<li><h2>${title}</h2><p>${description}</p></li>`)
    .join("\n");
}

const pages = [
  {
    slug: "",
    source: "home.content.html",
    title: "YYC Skate Spots | Calgary street skate spots",
    heading: "YYC Skate Spots",
    description: "A practical map of Calgary street skate spots, built by local skaters.",
  },
  {
    slug: "privacy",
    source: "privacy.content.html",
    title: "Privacy policy | YYC Skate Spots",
    heading: "YYC Skate Spots privacy policy",
    description:
      "How YYC Skate Spots handles accounts, location, submissions, reports, photos, and deletion.",
  },
  {
    slug: "support",
    source: "support.content.html",
    title: "Support | YYC Skate Spots",
    heading: "YYC Skate Spots support",
    description: "Get help with YYC Skate Spots accounts, privacy, moderation, or app problems.",
  },
  {
    slug: "standards",
    source: "standards.content.html",
    title: "Spot standards | YYC Skate Spots",
    heading: "YYC Skate Spots community standards",
    description: "The submission, review, reporting, and moderation rules for YYC Skate Spots.",
  },
  {
    slug: "share",
    source: "share.content.html",
    title: "A skate spot was shared with you | YYC Skate Spots",
    heading: "A Calgary skate spot was shared with you",
    description: "Open YYC Skate Spots to see photos, notes, and directions.",
    extraHead: `<meta name="apple-itunes-app" content="app-id=${appStoreId}" />`,
  },
];

for (const page of pages) {
  const pageUrl = new URL(page.slug ? `/${page.slug}` : "/", shareOrigin).toString();
  const content = interpolate(await readFile(path.join(sourceRoot, page.source), "utf8"), {
    APP_STORE_URL: appStoreUrl,
    SPOT_STANDARDS: renderStandards(),
    SUPPORT_EMAIL: supportEmail,
  });
  const html = interpolate(template, {
    CANONICAL_URL: pageUrl,
    EXTRA_HEAD: page.extraHead ?? "",
    META_DESCRIPTION: page.description,
    OG_TITLE: page.heading,
    PAGE_CONTENT: content,
    PAGE_TITLE: page.title,
    SHARE_ORIGIN: shareOrigin,
  });
  const pageDirectory = path.join(outputRoot, page.slug);
  await mkdir(pageDirectory, { recursive: true });
  await writeFile(path.join(pageDirectory, "index.html"), html);
}

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

await mkdir(path.join(outputRoot, ".well-known"), { recursive: true });
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
await copyFile(
  path.join(projectRoot, "assets/images/favicon.png"),
  path.join(outputRoot, "favicon.png"),
);
await copyFile(path.join(sourceRoot, "styles.css"), path.join(outputRoot, "styles.css"));

console.log(`Built the share site in ${outputRoot}`);
