// @vitest-environment node

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

const buildScript = fileURLToPath(new URL("./build-share-site.mjs", import.meta.url));
const standardsSource = fileURLToPath(new URL("../src/lib/spot-standards.json", import.meta.url));
let outputRoot: string;

beforeEach(() => {
  outputRoot = mkdtempSync(path.join(tmpdir(), "yyc-share-site-"));
});

afterEach(() => {
  rmSync(outputRoot, { force: true, recursive: true });
});

function build(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  return spawnSync(process.execPath, [buildScript], {
    encoding: "utf8",
    env: {
      ...process.env,
      APPLE_TEAM_ID: "4A8Q8XX972",
      APP_STORE_ID: "6807476193",
      EXPO_PUBLIC_SHARE_BASE_URL: "https://yycskatespots.com",
      SHARE_SITE_OUTPUT_DIR: outputRoot,
      ...overrides,
    },
  });
}

describe("build-share-site", () => {
  test("builds every public page from one shell without unresolved placeholders", () => {
    const result = build();

    expect(result.status, result.stderr).toBe(0);
    for (const relativePath of [
      "index.html",
      "privacy/index.html",
      "support/index.html",
      "standards/index.html",
      "share/index.html",
    ]) {
      const html = readFileSync(path.join(outputRoot, relativePath), "utf8");
      expect(html).toContain("YYC Skate Spots");
      expect(html).not.toMatch(/{{[A-Z0-9_]+}}/);
    }

    const privacy = readFileSync(path.join(outputRoot, "privacy/index.html"), "utf8");
    expect(privacy).toContain("support@yycskatespots.com");
    for (const provider of ["Clerk", "Convex", "Google", "Apple", "Cloudflare"]) {
      expect(privacy).toContain(provider);
    }

    const standards = readFileSync(path.join(outputRoot, "standards/index.html"), "utf8");
    const source = JSON.parse(readFileSync(standardsSource, "utf8")) as {
      title: string;
      description: string;
    }[];
    for (const rule of source) {
      expect(standards).toContain(rule.title);
      expect(standards).toContain(rule.description);
    }
  });

  test("keeps Universal Links limited to the shared-spot route", () => {
    expect(build().status).toBe(0);

    const association = JSON.parse(
      readFileSync(path.join(outputRoot, ".well-known/apple-app-site-association"), "utf8"),
    );
    expect(association.applinks.details).toEqual([
      {
        appIDs: ["4A8Q8XX972.com.yycskatespots.app"],
        components: [
          {
            "/": "/share",
            comment: "Opens a shared skate spot in YYC Skate Spots.",
          },
        ],
      },
    ]);
  });

  test("fails before writing when the public origin is missing", () => {
    const result = build({ EXPO_PUBLIC_SHARE_BASE_URL: "" });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("EXPO_PUBLIC_SHARE_BASE_URL is required");
  });
});
