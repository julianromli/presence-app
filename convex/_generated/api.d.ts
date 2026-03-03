/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as attendance from "../attendance.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as dashboardOverviewShape from "../dashboardOverviewShape.js";
import type * as helpers from "../helpers.js";
import type * as qrTokens from "../qrTokens.js";
import type * as reportIdempotency from "../reportIdempotency.js";
import type * as reports from "../reports.js";
import type * as reportsNode from "../reportsNode.js";
import type * as settings from "../settings.js";
import type * as users from "../users.js";
import type * as usersList from "../usersList.js";
import type * as usersPolicy from "../usersPolicy.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  attendance: typeof attendance;
  crons: typeof crons;
  dashboard: typeof dashboard;
  dashboardOverviewShape: typeof dashboardOverviewShape;
  helpers: typeof helpers;
  qrTokens: typeof qrTokens;
  reportIdempotency: typeof reportIdempotency;
  reports: typeof reports;
  reportsNode: typeof reportsNode;
  settings: typeof settings;
  users: typeof users;
  usersList: typeof usersList;
  usersPolicy: typeof usersPolicy;
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
