// @vitest-environment node

import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

const setupScript = fileURLToPath(new URL("./setup-worktree.sh", import.meta.url));

type SetupResult = ReturnType<typeof spawnSync> & { stderr: string; stdout: string };

interface Fixture {
  bunCalls: string;
  main: string;
  worktree: string;
}

let testRoot: string;

beforeEach(() => {
  testRoot = mkdtempSync(path.join(tmpdir(), "yyc-worktree-setup-"));
});

afterEach(() => {
  rmSync(testRoot, { force: true, recursive: true });
});

/** Runs Git without inheriting output from disposable repository setup. */
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/** Creates a primary checkout, one linked worktree, and a Bun command recorder. */
function createFixture(): Fixture {
  const main = path.join(testRoot, "main");
  const worktree = path.join(testRoot, "worktree");
  const bin = path.join(testRoot, "bin");
  const bunCalls = path.join(testRoot, "bun-calls.txt");

  mkdirSync(main);
  mkdirSync(bin);
  git(main, "init", "-b", "main");
  writeFileSync(path.join(main, ".gitignore"), ".env\n.env*.local\nnode_modules/\n");
  writeFileSync(path.join(main, ".env.example"), "GOOGLE_MAPS_API_KEY_ANDROID=\n");
  writeFileSync(path.join(main, "package.json"), '{"private":true}\n');
  writeFileSync(
    path.join(main, ".env"),
    [
      "GOOGLE_MAPS_API_KEY_ANDROID=android-secret",
      "GOOGLE_MAPS_API_KEY_IOS=ios-secret",
      "EXPO_PUBLIC_CONVEX_URL=https://example.convex.cloud",
      "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=clerk-secret",
      "",
    ].join("\n"),
  );
  writeFileSync(path.join(main, ".env.local"), "CONVEX_DEPLOYMENT=dev:example\n");
  git(main, "add", ".gitignore", ".env.example", "package.json");
  git(
    main,
    "-c",
    "user.name=Worktree Test",
    "-c",
    "user.email=worktree@example.com",
    "commit",
    "-m",
    "fixture",
  );
  git(main, "worktree", "add", "-b", "feature/test", worktree);

  const fakeBun = path.join(bin, "bun");
  writeFileSync(fakeBun, '#!/usr/bin/env bash\nprintf \'%s\\n\' "$*" >> "$BUN_CALLS_FILE"\n');
  chmodSync(fakeBun, 0o755);

  return { bunCalls, main, worktree };
}

/** Runs setup with T3-specific variables removed unless a test supplies them. */
function runSetup(
  fixture: Fixture,
  cwd = fixture.worktree,
  extraEnv: Partial<NodeJS.ProcessEnv> = {},
): SetupResult {
  const env = { ...process.env };
  delete env.T3CODE_PROJECT_ROOT;
  delete env.T3CODE_WORKTREE_PATH;
  Object.assign(env, extraEnv, {
    BUN_CALLS_FILE: fixture.bunCalls,
    PATH: `${path.join(testRoot, "bin")}:${env.PATH ?? ""}`,
  });

  return spawnSync("bash", [setupScript], {
    cwd,
    encoding: "utf8",
    env,
  }) as SetupResult;
}

describe("setup-worktree", () => {
  test("links both env files, installs frozen dependencies, and leaves Git clean", () => {
    const fixture = createFixture();
    const result = runSetup(fixture);

    expect(result.status).toBe(0);
    expect(readlinkSync(path.join(fixture.worktree, ".env"))).toBe(path.join(fixture.main, ".env"));
    expect(readlinkSync(path.join(fixture.worktree, ".env.local"))).toBe(
      path.join(fixture.main, ".env.local"),
    );
    expect(readFileSync(fixture.bunCalls, "utf8")).toBe("install --frozen-lockfile\n");
    expect(git(fixture.worktree, "status", "--short")).toBe("");

    writeFileSync(path.join(fixture.main, ".env.local"), "CONVEX_DEPLOYMENT=dev:updated\n");
    expect(readFileSync(path.join(fixture.worktree, ".env.local"), "utf8")).toContain(
      "dev:updated",
    );
  });

  test("uses T3 paths and is idempotent", () => {
    const fixture = createFixture();
    const env = {
      T3CODE_PROJECT_ROOT: fixture.main,
      T3CODE_WORKTREE_PATH: fixture.worktree,
    };

    expect(runSetup(fixture, fixture.worktree, env).status).toBe(0);
    const second = runSetup(fixture, fixture.worktree, env);

    expect(second.status).toBe(0);
    expect(second.stdout).toContain("is already linked; leaving it unchanged");
    expect(readFileSync(fixture.bunCalls, "utf8")).toBe(
      "install --frozen-lockfile\ninstall --frozen-lockfile\n",
    );
  });

  test("does nothing in the primary checkout", () => {
    const fixture = createFixture();
    const result = runSetup(fixture, fixture.main);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Already in the primary checkout");
    expect(() => readFileSync(fixture.bunCalls, "utf8")).toThrow();
  });

  test.each([
    [".env", "Create it there first"],
    [".env.local", "Complete the first Convex setup"],
  ])("reports a missing primary %s with recovery guidance", (filename, guidance) => {
    const fixture = createFixture();
    rmSync(path.join(fixture.main, filename));

    const result = runSetup(fixture);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`No ${filename} in the primary checkout`);
    expect(result.stderr).toContain(guidance);
    expect(() => readFileSync(fixture.bunCalls, "utf8")).toThrow();
  });

  test("preflights both targets before refusing an existing regular file", () => {
    const fixture = createFixture();
    const target = path.join(fixture.worktree, ".env.local");
    writeFileSync(target, "WORKTREE_ONLY=value\n");

    const result = runSetup(fixture);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${target} already exists`);
    expect(readFileSync(target, "utf8")).toBe("WORKTREE_ONLY=value\n");
    expect(() => readlinkSync(path.join(fixture.worktree, ".env"))).toThrow();
  });

  test.each([
    ["existing", true],
    ["dangling", false],
  ])("refuses to replace a symlink to another %s target", (_kind, createTarget) => {
    const fixture = createFixture();
    const target = path.join(fixture.worktree, ".env");
    const otherTarget = path.join(testRoot, "other.env");
    if (createTarget) {
      writeFileSync(otherTarget, "OTHER=value\n");
    }
    symlinkSync(otherTarget, target);

    const result = runSetup(fixture);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${target} points to ${otherTarget}`);
    expect(readlinkSync(target)).toBe(otherTarget);
  });

  test("reports missing names without printing values", () => {
    const fixture = createFixture();
    writeFileSync(
      path.join(fixture.main, ".env.local"),
      "EXPO_PUBLIC_CONVEX_URL=\"\"\nCONVEX_DEPLOYMENT=''\nIGNORED_VALUE=do-not-print\n",
    );

    const result = runSetup(fixture);
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("EXPO_PUBLIC_CONVEX_URL");
    expect(result.stderr).toContain("CONVEX_DEPLOYMENT");
    expect(output).not.toContain("android-secret");
    expect(output).not.toContain("ios-secret");
    expect(output).not.toContain("clerk-secret");
    expect(output).not.toContain("do-not-print");
  });

  test("rejects a T3 project root from another repository", () => {
    const fixture = createFixture();
    const other = path.join(testRoot, "other-repo");
    mkdirSync(other);
    git(other, "init", "-b", "main");

    const result = runSetup(fixture, fixture.worktree, {
      T3CODE_PROJECT_ROOT: other,
      T3CODE_WORKTREE_PATH: fixture.worktree,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("are not from the same repository");
    expect(() => readFileSync(fixture.bunCalls, "utf8")).toThrow();
  });
});
