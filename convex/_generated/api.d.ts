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
import type * as attendanceList from "../attendanceList.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as dashboardEmployee from "../dashboardEmployee.js";
import type * as dashboardOverviewShape from "../dashboardOverviewShape.js";
import type * as deviceHeartbeat from "../deviceHeartbeat.js";
import type * as deviceHeartbeatPolicy from "../deviceHeartbeatPolicy.js";
import type * as employeeDashboardKpi from "../employeeDashboardKpi.js";
import type * as helpers from "../helpers.js";
import type * as qrPolicy from "../qrPolicy.js";
import type * as qrTokens from "../qrTokens.js";
import type * as reportIdempotency from "../reportIdempotency.js";
import type * as reports from "../reports.js";
import type * as reportsNode from "../reportsNode.js";
import type * as settings from "../settings.js";
import type * as users from "../users.js";
import type * as usersList from "../usersList.js";
import type * as usersPolicy from "../usersPolicy.js";
import type * as workspaceInvitePolicy from "../workspaceInvitePolicy.js";
import type * as workspaceInviteView from "../workspaceInviteView.js";
import type * as workspaceMembersPolicy from "../workspaceMembersPolicy.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  attendance: typeof attendance;
  attendanceList: typeof attendanceList;
  crons: typeof crons;
  dashboard: typeof dashboard;
  dashboardEmployee: typeof dashboardEmployee;
  dashboardOverviewShape: typeof dashboardOverviewShape;
  deviceHeartbeat: typeof deviceHeartbeat;
  deviceHeartbeatPolicy: typeof deviceHeartbeatPolicy;
  employeeDashboardKpi: typeof employeeDashboardKpi;
  helpers: typeof helpers;
  qrPolicy: typeof qrPolicy;
  qrTokens: typeof qrTokens;
  reportIdempotency: typeof reportIdempotency;
  reports: typeof reports;
  reportsNode: typeof reportsNode;
  settings: typeof settings;
  users: typeof users;
  usersList: typeof usersList;
  usersPolicy: typeof usersPolicy;
  workspaceInvitePolicy: typeof workspaceInvitePolicy;
  workspaceInviteView: typeof workspaceInviteView;
  workspaceMembersPolicy: typeof workspaceMembersPolicy;
  workspaces: typeof workspaces;
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
