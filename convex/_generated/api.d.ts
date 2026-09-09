/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountDeletion from "../accountDeletion.js";
import type * as auth from "../auth.js";
import type * as constants from "../constants.js";
import type * as displayNames from "../displayNames.js";
import type * as favorites from "../favorites.js";
import type * as http from "../http.js";
import type * as moderation from "../moderation.js";
import type * as moderationModel from "../moderationModel.js";
import type * as profileModel from "../profileModel.js";
import type * as profiles from "../profiles.js";
import type * as reports from "../reports.js";
import type * as seed from "../seed.js";
import type * as spots from "../spots.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountDeletion: typeof accountDeletion;
  auth: typeof auth;
  constants: typeof constants;
  displayNames: typeof displayNames;
  favorites: typeof favorites;
  http: typeof http;
  moderation: typeof moderation;
  moderationModel: typeof moderationModel;
  profileModel: typeof profileModel;
  profiles: typeof profiles;
  reports: typeof reports;
  seed: typeof seed;
  spots: typeof spots;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
