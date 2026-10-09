// Builds that install side by side on one device. iOS keys an install by
// bundle ID, and a URL scheme claimed by two installed apps opens either one,
// so every variant needs its own of both. app.config.ts reads this at build
// time, so it must stay free of native imports.
export const APP_VARIANTS = {
  development: {
    name: "YYC Dev",
    bundleId: "com.yycskatespots.app.dev",
    scheme: "yycskatespots-dev",
    icon: "./assets/images/icon-dev.png",
  },
  preview: {
    name: "YYC Preview",
    bundleId: "com.yycskatespots.app.preview",
    scheme: "yycskatespots-preview",
    icon: "./assets/images/icon-preview.png",
  },
  production: {
    name: "YYC Skate Spots",
    bundleId: "com.yycskatespots.app",
    scheme: "yycskatespots",
    icon: "./assets/images/icon.png",
  },
} as const;

export type AppVariant = keyof typeof APP_VARIANTS;

function isAppVariant(value: string): value is AppVariant {
  return Object.hasOwn(APP_VARIANTS, value);
}

/** Unset means production, so CI and any profile missing APP_VARIANT build the store app. */
export function parseAppVariant(value: string | undefined): AppVariant {
  if (!value) {
    return "production";
  }
  if (!isAppVariant(value)) {
    throw new Error(`APP_VARIANT must be one of ${Object.keys(APP_VARIANTS).join(", ")}.`);
  }
  return value;
}
