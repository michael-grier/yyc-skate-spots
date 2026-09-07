import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const expoCli = fileURLToPath(new URL("../node_modules/expo/bin/cli", import.meta.url));

// Capture the resolved config so build-time credentials cannot reach CI logs.
const result = spawnSync(process.execPath, [expoCli, "config", "--type", "introspect", "--json"], {
  cwd: projectRoot,
  encoding: "utf8",
  env: {
    ...process.env,
    EXPO_NO_DOTENV: "1",
    EXPO_PUBLIC_SHARE_BASE_URL: "https://yycskatespots.com",
    GOOGLE_MAPS_API_KEY_ANDROID: "ios-release-verification-placeholder",
    GOOGLE_MAPS_API_KEY_IOS: "ios-release-verification-placeholder",
  },
  maxBuffer: 10 * 1024 * 1024,
});

if (result.status !== 0) {
  throw new Error("Expo could not resolve the iOS release configuration.");
}

let config;
try {
  config = JSON.parse(result.stdout);
} catch {
  throw new Error("Expo returned an unreadable iOS release configuration.");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`iOS release configuration is invalid: ${message}`);
  }
}

function sorted(values) {
  return [...values].sort();
}

function assertStringSet(actual, expected, label) {
  assert(Array.isArray(actual), `${label} is missing`);
  assert(
    JSON.stringify(sorted(actual)) === JSON.stringify(sorted(expected)),
    `${label} does not match the audited values`,
  );
}

const ios = config.ios;
const infoPlist = config._internal?.modResults?.ios?.infoPlist;
const entitlements = config._internal?.modResults?.ios?.entitlements;
const privacyManifest = ios?.privacyManifests;

assert(ios?.bundleIdentifier === "com.yycskatespots.app", "the bundle identifier changed");
assert(ios?.config?.usesNonExemptEncryption === false, "export compliance is not declared");
assert(
  infoPlist?.ITSAppUsesNonExemptEncryption === false,
  "ITSAppUsesNonExemptEncryption is not false in Info.plist",
);

assert(privacyManifest?.NSPrivacyTracking === false, "tracking must remain disabled");
assertStringSet(privacyManifest?.NSPrivacyTrackingDomains, [], "tracking domains");

const expectedRequiredReasons = new Map([
  ["NSPrivacyAccessedAPICategoryFileTimestamp", ["0A2A.1", "3B52.1", "C617.1"]],
  ["NSPrivacyAccessedAPICategoryDiskSpace", ["85F4.1", "E174.1"]],
  ["NSPrivacyAccessedAPICategorySystemBootTime", ["35F9.1"]],
  ["NSPrivacyAccessedAPICategoryUserDefaults", ["1C8F.1", "CA92.1"]],
]);
const requiredReasons = privacyManifest?.NSPrivacyAccessedAPITypes;

assert(
  Array.isArray(requiredReasons) && requiredReasons.length === expectedRequiredReasons.size,
  "required-reason API categories changed",
);
for (const entry of requiredReasons) {
  const expected = expectedRequiredReasons.get(entry.NSPrivacyAccessedAPIType);
  assert(expected, `unexpected required-reason API ${entry.NSPrivacyAccessedAPIType}`);
  assertStringSet(
    entry.NSPrivacyAccessedAPITypeReasons,
    expected,
    `${entry.NSPrivacyAccessedAPIType} reasons`,
  );
}

const expectedCollectedDataTypes = [
  "NSPrivacyCollectedDataTypeName",
  "NSPrivacyCollectedDataTypeEmailAddress",
  "NSPrivacyCollectedDataTypePreciseLocation",
  "NSPrivacyCollectedDataTypePhotosorVideos",
  "NSPrivacyCollectedDataTypeOtherUserContent",
  "NSPrivacyCollectedDataTypeUserID",
  "NSPrivacyCollectedDataTypeProductInteraction",
];
const collectedDataTypes = privacyManifest?.NSPrivacyCollectedDataTypes;

assert(
  Array.isArray(collectedDataTypes) &&
    collectedDataTypes.length === expectedCollectedDataTypes.length,
  "collected data types changed",
);
assertStringSet(
  collectedDataTypes.map((entry) => entry.NSPrivacyCollectedDataType),
  expectedCollectedDataTypes,
  "collected data types",
);
for (const entry of collectedDataTypes) {
  assert(
    entry.NSPrivacyCollectedDataTypeLinked === true,
    `${entry.NSPrivacyCollectedDataType} must remain linked to the user`,
  );
  assert(
    entry.NSPrivacyCollectedDataTypeTracking === false,
    `${entry.NSPrivacyCollectedDataType} must not be used for tracking`,
  );
  assertStringSet(
    entry.NSPrivacyCollectedDataTypePurposes,
    ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
    `${entry.NSPrivacyCollectedDataType} purposes`,
  );
}

const expectedPermissionDescriptions = new Map([
  [
    "NSLocationWhenInUseUsageDescription",
    "YYC Skate Spots shows your position on the map and sorts spots by distance from you.",
  ],
  [
    "NSPhotoLibraryUsageDescription",
    "YYC Skate Spots lets you attach photos of a spot when you submit it.",
  ],
  [
    "NSMotionUsageDescription",
    "YYC Skate Spots uses device motion to improve your position and orientation on the map.",
  ],
]);
for (const [key, expected] of expectedPermissionDescriptions) {
  assert(infoPlist?.[key] === expected, `${key} is missing or inaccurate`);
}

const unusedPermissionDescriptions = [
  "NSCameraUsageDescription",
  "NSFaceIDUsageDescription",
  "NSLocationAlwaysUsageDescription",
  "NSLocationAlwaysAndWhenInUseUsageDescription",
  "NSMicrophoneUsageDescription",
];
for (const key of unusedPermissionDescriptions) {
  assert(!(key in infoPlist), `${key} is present even though the app does not use it`);
}

assertStringSet(
  entitlements?.["com.apple.developer.applesignin"],
  ["Default"],
  "Sign in with Apple entitlement",
);
assertStringSet(
  entitlements?.["com.apple.developer.associated-domains"],
  ["applinks:yycskatespots.com"],
  "associated-domain entitlement",
);

console.log("iOS release configuration verified.");
