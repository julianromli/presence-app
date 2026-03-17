# Workspace Subscription Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workspace-scoped plan enforcement for `free`, `pro`, and `enterprise`, backed by a central code catalog and server-side entitlement checks for workspace creation, membership growth, device growth, premium settings, invite expiry, and report export.

**Architecture:** Keep the source of truth split between Convex data and Convex code. `workspaces.plan` becomes the runtime plan field, while a new focused Convex module owns the plan catalog and entitlement helpers. Server-side mutations and queries enforce limits first; UI surfaces consume a shared current-workspace capabilities helper so they can show plan badges, usage, and disabled premium actions without re-implementing plan logic in the client.

**Tech Stack:** Next.js 16 App Router, React 19, Convex, Clerk auth, TypeScript, JavaScript, Vitest

---

## File Map

**New files**
- `convex/plans.js`
  Owns the central plan catalog, plan validator, entitlement resolver, feature gates, and limit assertion helpers.
- `app/api/workspaces/current/route.ts`
  Returns the active workspace’s plan, entitlements, and usage for client-side soft gates.
- `lib/workspace-subscription-client.ts`
  Shared browser helper or hook for loading current workspace entitlements and refreshing on workspace-change events.
- `tests/workspace-plan-entitlements.test.ts`
  Covers the plan catalog and helper behavior directly.
- `tests/workspaces-subscription.test.ts`
  Covers create/join/reactivation and invite-expiry enforcement at the Convex handler layer.
- `tests/devices-plan-limits.test.ts`
  Covers `devices:createRegistrationCode` and `devices:claimRegistrationCode` directly.
- `tests/settings-plan-gates.test.ts`
  Covers `settings:update` premium gating directly.
- `tests/workspace-current-route.test.ts`
  Covers the new current-workspace summary route contract.
- `tests/workspace-plan-ui.test.ts`
  Covers extracted UI helper behavior for plan badges, usage labels, and disabled states.

**Existing files to modify**
- `convex/schema.js`
  Add the workspace `plan` field and any supporting index needed for creation-limit lookup.
- `convex/workspaces.js`
  Write default plan data, expose plan summary payloads with usage counts, enforce create and join limits, and add invite-expiry management.
- `convex/users.js`
  Enforce member limits when a superadmin reactivates inactive workspace members.
- `convex/devices.js`
  Enforce max-device limits before code generation and again before device claim.
- `convex/settings.js`
  Enforce premium feature gates for geofence, IP whitelist, and attendance schedule updates.
- `convex/reports.js`
  Enforce `reportExport` before returning download URLs.
- `app/api/admin/workspace/route.ts`
  Return the expanded workspace management contract and accept invite-expiry updates.
- `types/dashboard.ts`
  Add typed plan, entitlement, and usage shapes used by dashboard surfaces.
- `components/dashboard/workspace-panel.tsx`
  Show the current plan, usage summary, invite expiry controls, and attendance schedule soft gate.
- `components/dashboard/geofence-panel.tsx`
  Use the shared current-workspace entitlement helper and disable premium-only controls on free.
- `components/dashboard/device-management-panel.tsx`
  Use the shared current-workspace entitlement helper and disable `Generate code` when the device cap is reached.
- `components/dashboard/report-panel.tsx`
  Use the shared current-workspace entitlement helper and disable report download when export is unavailable.
- `tests/admin-workspace-route.test.ts`
  Update GET expectations for the expanded workspace management payload and add invite-expiry action coverage.
- `tests/workspace-routes.test.ts`
  Verify create and join routes preserve new plan-limit errors.
- `tests/admin-routes-workspace-policy.test.ts`
  Add PATCH coverage for admin member reactivation limit failures.
- `tests/device-bootstrap-routes.test.ts`
  Verify device-claim route preserves plan-limit failures.
- `tests/admin-device-management-routes.test.ts`
  Verify registration-code route preserves plan-limit failures.
- `tests/security-auth-rbac.test.ts`
  Verify premium settings failures are surfaced correctly.
- `tests/reports-convex.test.ts`
  Verify report export is blocked on free.
- `tests/admin-reports-download-route.test.ts`
  Verify report-download route preserves `FEATURE_NOT_AVAILABLE`.

## Creation-Time Entitlement Source

Workspace creation needs one explicit policy before implementation:

- if the actor owns no active workspace yet, creation is evaluated as `free`
- otherwise, creation uses the highest plan among the actor’s active owned workspaces
- this lets an upgraded owner create additional workspaces without inventing a separate account-level billing record

Implementation rule:
- add one helper in `convex/workspaces.js` that resolves the actor’s create-time entitlement source
- keep `maxOwnedWorkspaces` in `PLAN_CATALOG`
- enforce it only through this helper

## Task 1: Add the Central Plan Catalog and Entitlement Helpers

**Files:**
- Create: `convex/plans.js`
- Create: `tests/workspace-plan-entitlements.test.ts`

- [ ] **Step 1: Write the failing plan-catalog tests**

Add focused tests for:
- free limits and feature flags
- pro limits and feature flags
- enterprise unlimited behavior using `null`
- fallback behavior when a workspace is missing `plan`
- plan ranking for create-time entitlement resolution
- invalid stored plan values

Use a test shape like:

```ts
import { describe, expect, it } from "vitest";

import {
  PLAN_CATALOG,
  compareWorkspacePlans,
  resolveWorkspacePlan,
  resolveWorkspaceEntitlements,
  isPlanLimitReached,
} from "../convex/plans";

describe("workspace plan entitlements", () => {
  it("defaults missing plan to free", () => {
    expect(resolveWorkspacePlan({ plan: undefined })).toBe("free");
  });

  it("ranks enterprise higher than pro and free", () => {
    expect(compareWorkspacePlans("enterprise", "pro")).toBeGreaterThan(0);
    expect(compareWorkspacePlans("pro", "free")).toBeGreaterThan(0);
  });

  it("throws WORKSPACE_PLAN_INVALID for unknown stored plan values", () => {
    expect(() => resolveWorkspacePlan({ plan: "starter" })).toThrow(/WORKSPACE_PLAN_INVALID/);
  });

  it("treats null limits as unlimited", () => {
    expect(isPlanLimitReached(null, 999)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the new test to confirm it fails**

Run: `bun run test tests/workspace-plan-entitlements.test.ts`

Expected: FAIL because `convex/plans.js` does not exist yet.

- [ ] **Step 3: Implement the minimal plan module**

Create `convex/plans.js` with:
- `workspacePlanValidator`
- `PLAN_CATALOG`
- `compareWorkspacePlans(left, right)`
- `resolveWorkspacePlan(workspaceLike)`
- `resolveWorkspaceEntitlements(plan)`
- `isPlanLimitReached(limit, currentCount)`
- `assertPlanLimitNotReached(...)`
- `assertWorkspaceFeatureEnabled(...)`

Use a shape like:

```js
import { ConvexError, v } from "convex/values";

export const workspacePlanValidator = v.union(
  v.literal("free"),
  v.literal("pro"),
  v.literal("enterprise"),
);

export const PLAN_CATALOG = {
  free: {
    limits: { maxOwnedWorkspaces: 1, maxMembersPerWorkspace: 5, maxDevicesPerWorkspace: 1 },
    features: {
      geofence: false,
      ipWhitelist: false,
      attendanceSchedule: false,
      reportExport: false,
      inviteRotation: true,
      inviteExpiry: false,
    },
  },
  pro: {
    limits: { maxOwnedWorkspaces: 5, maxMembersPerWorkspace: 50, maxDevicesPerWorkspace: 3 },
    features: {
      geofence: true,
      ipWhitelist: true,
      attendanceSchedule: true,
      reportExport: true,
      inviteRotation: true,
      inviteExpiry: true,
    },
  },
  enterprise: {
    limits: { maxOwnedWorkspaces: null, maxMembersPerWorkspace: null, maxDevicesPerWorkspace: null },
    features: {
      geofence: true,
      ipWhitelist: true,
      attendanceSchedule: true,
      reportExport: true,
      inviteRotation: true,
      inviteExpiry: true,
    },
  },
};
```

Do not add per-workspace custom overrides in this rollout.

Resolver rule:
- missing `plan` falls back to `free`
- unknown non-empty `plan` throws `WORKSPACE_PLAN_INVALID`

- [ ] **Step 4: Re-run the plan-catalog test**

Run: `bun run test tests/workspace-plan-entitlements.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the catalog foundation**

```bash
git add convex/plans.js tests/workspace-plan-entitlements.test.ts
git commit -m "feat(billing): add workspace plan catalog"
```

## Task 2: Persist Workspace Plan and Expose Current Workspace Capabilities

**Files:**
- Modify: `convex/schema.js`
- Modify: `convex/workspaces.js`
- Modify: `app/api/admin/workspace/route.ts`
- Modify: `types/dashboard.ts`
- Create: `app/api/workspaces/current/route.ts`
- Create: `tests/workspace-current-route.test.ts`
- Modify: `tests/admin-workspace-route.test.ts`

- [ ] **Step 1: Write the failing route contract tests**

Add route tests that require:
- `GET /api/workspaces/current` returns the active workspace id, plan, limits, features, and usage
- `GET /api/admin/workspace` returns the expanded subscription summary

Target contract:

```ts
expect(payload.subscription).toEqual({
  plan: "free",
  limits: {
    maxOwnedWorkspaces: 1,
    maxMembersPerWorkspace: 5,
    maxDevicesPerWorkspace: 1,
  },
  features: {
    geofence: false,
    ipWhitelist: false,
    attendanceSchedule: false,
    reportExport: false,
    inviteRotation: true,
    inviteExpiry: false,
  },
  usage: {
    activeMembers: 3,
    activeDevices: 1,
  },
});
```

- [ ] **Step 2: Run the failing route tests**

Run:

```bash
bun run test tests/workspace-current-route.test.ts
bun run test tests/admin-workspace-route.test.ts
```

Expected: FAIL because the new route and expanded payload do not exist yet.

- [ ] **Step 3: Add the plan field and summary query**

Update `convex/schema.js`:
- add `plan: v.optional(workspacePlanValidator)` to `workspaces`
- add an index that supports owned-workspace lookup, such as `by_created_by_user`

Update `convex/workspaces.js`:
- include `plan` in `workspaceValidator`
- return `plan: "free"` when `workspace.plan` is missing
- add a helper that returns:
  - `plan`
  - `limits`
  - `features`
  - `usage`
- add a query like `currentWorkspaceSummary`
- update `workspaceManagementDetail` to return `subscription`

Write new workspaces with `plan: "free"`:

```js
const workspaceId = await ctx.db.insert("workspaces", {
  slug,
  name,
  plan: "free",
  isActive: true,
  createdAt: now,
  updatedAt: now,
  createdByUserId: user._id,
});
```

Keep rollout safe by treating missing legacy `plan` values as `free`.

- [ ] **Step 4: Add the current-workspace route and types**

Create `app/api/workspaces/current/route.ts`:
- require workspace header via `requireWorkspaceApiContext`
- allow any active workspace role
- query the new `workspaces:currentWorkspaceSummary`

Update `types/dashboard.ts` with reusable shapes:
- `WorkspacePlan`
- `WorkspaceEntitlements`
- `WorkspaceSubscriptionUsage`
- `WorkspaceSubscriptionSummary`

- [ ] **Step 5: Re-run the route tests**

Run:

```bash
bun run test tests/workspace-current-route.test.ts
bun run test tests/admin-workspace-route.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit the data-contract changes**

```bash
git add convex/schema.js convex/workspaces.js app/api/admin/workspace/route.ts app/api/workspaces/current/route.ts types/dashboard.ts tests/workspace-current-route.test.ts tests/admin-workspace-route.test.ts
git commit -m "feat(billing): expose workspace subscription summary"
```

## Task 3: Enforce Create-Time Workspace Limits

**Files:**
- Modify: `convex/workspaces.js`
- Modify: `tests/workspaces-subscription.test.ts`
- Modify: `tests/workspace-routes.test.ts`

- [ ] **Step 1: Write the failing create-limit tests**

Cover these cases:
- first owned workspace is evaluated as `free`
- a free owner cannot create a second active owned workspace
- a pro owner can create more workspaces after an owned workspace is upgraded
- enterprise still behaves as unlimited because its catalog limit is `null`

Use a direct handler expectation like:

```ts
await expect(
  createWorkspace.handler(ctx as never, { name: "Second Workspace" }),
).rejects.toMatchObject({
  data: {
    code: "PLAN_LIMIT_REACHED",
    message: expect.stringMatching(/workspace/i),
  },
});
```

Also add a route-level assertion that `/api/workspaces/create` preserves the domain error code.

- [ ] **Step 2: Run the create-limit tests**

Run:

```bash
bun run test tests/workspaces-subscription.test.ts
bun run test tests/workspace-routes.test.ts
```

Expected: FAIL because create flow still ignores plan limits.

- [ ] **Step 3: Implement the create-time entitlement resolver**

In `convex/workspaces.js`:
- look up the actor’s active owned workspaces
- resolve the highest owned plan
- fall back to `free` when none exist
- enforce `maxOwnedWorkspaces` from that derived plan

Suggested shape:

```js
const ownedRows = await ctx.db
  .query("workspaces")
  .withIndex("by_created_by_user", (q) => q.eq("createdByUserId", user._id))
  .collect();

const activeOwned = ownedRows.filter((row) => row.isActive);
const creationPlan = activeOwned.reduce(
  (best, row) =>
    compareWorkspacePlans(resolveWorkspacePlan(row), best) > 0
      ? resolveWorkspacePlan(row)
      : best,
  "free",
);
```

Legacy note:
- `createdByUserId` is optional on older rows, so production enforcement must either backfill that field first or add a fallback ownership derivation.
- Current implementation fallback: treat an active `superadmin` membership as ownership only for active workspaces whose `createdByUserId` is still missing, then dedupe by workspace id before counting.

- [ ] **Step 4: Re-run the create-limit tests**

Run:

```bash
bun run test tests/workspaces-subscription.test.ts
bun run test tests/workspace-routes.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit the create guard**

```bash
git add convex/workspaces.js tests/workspaces-subscription.test.ts tests/workspace-routes.test.ts
git commit -m "feat(billing): enforce workspace creation limits"
```

## Task 4: Enforce Member Limits on Join and Reactivation

**Files:**
- Modify: `convex/workspaces.js`
- Modify: `convex/users.js`
- Modify: `tests/workspaces-subscription.test.ts`
- Modify: `tests/workspace-routes.test.ts`
- Modify: `tests/admin-routes-workspace-policy.test.ts`

- [ ] **Step 1: Write the failing membership-limit tests**

Cover both paths that can increase active membership count:
- `workspaces:joinWorkspaceByCode`
- `users:updateAdminManagedFields` when `isActive` flips from `false` to `true`

Clarification:
- join-path enforcement lives in `convex/workspaces.js`
- admin reactivation enforcement lives in `convex/users.js`

Use expectations like:

```ts
await expect(
  joinWorkspaceByCode.handler(ctx as never, { code: "TEAM-7K4M-ABSENIN" }),
).rejects.toMatchObject({
  data: {
    code: "PLAN_LIMIT_REACHED",
    message: expect.stringMatching(/member/i),
  },
});
```

For the join route and admin route tests, make the mocked mutation throw a Convex-style error payload and verify the HTTP response preserves that code.

- [ ] **Step 2: Run the membership-limit tests**

Run:

```bash
bun run test tests/workspaces-subscription.test.ts
bun run test tests/workspace-routes.test.ts
bun run test tests/admin-routes-workspace-policy.test.ts
```

Expected: FAIL because join and reactivation still ignore member caps.

- [ ] **Step 3: Implement shared member counting**

In `convex/workspaces.js`:
- add a small helper that counts active members in a workspace
- call it before inserting a new membership
- call it before reactivating an inactive membership

In `convex/users.js`:
- only run the limit check when a PATCH would increase active member count
- skip the check for no-op updates

- [ ] **Step 4: Re-run the membership-limit tests**

Run:

```bash
bun run test tests/workspaces-subscription.test.ts
bun run test tests/workspace-routes.test.ts
bun run test tests/admin-routes-workspace-policy.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit the membership guards**

```bash
git add convex/workspaces.js convex/users.js tests/workspaces-subscription.test.ts tests/workspace-routes.test.ts tests/admin-routes-workspace-policy.test.ts
git commit -m "feat(billing): enforce workspace member limits"
```

## Task 5: Enforce Device Limits with Direct Convex Coverage

**Files:**
- Modify: `convex/devices.js`
- Create: `tests/devices-plan-limits.test.ts`
- Modify: `tests/device-bootstrap-routes.test.ts`
- Modify: `tests/admin-device-management-routes.test.ts`

- [ ] **Step 1: Write the failing direct device-limit tests**

Add direct behavior coverage around both device-creation paths:
- `devices:createRegistrationCode` rejects when active devices already hit the limit
- `devices:claimRegistrationCode` rejects too, so old pending codes cannot bypass the cap

Use a direct handler expectation like:

```ts
await expect(
  createRegistrationCode.handler(ctx as never, { workspaceId: "workspace_123456" as never }),
).rejects.toMatchObject({
  data: {
    code: "PLAN_LIMIT_REACHED",
    message: expect.stringMatching(/device/i),
  },
});
```

Then add route-level assertions that mocked `PLAN_LIMIT_REACHED` errors are preserved for admin registration-code and public device-claim routes.

- [ ] **Step 2: Run the device-limit tests**

Run:

```bash
bun run test tests/devices-plan-limits.test.ts
bun run test tests/admin-device-management-routes.test.ts
bun run test tests/device-bootstrap-routes.test.ts
```

Expected: FAIL because device flow has no cap checks yet.

- [ ] **Step 3: Implement the device cap guards**

In `convex/devices.js`:
- count active devices in the workspace
- guard `createRegistrationCode`
- guard `claimRegistrationCode` again just before inserting the device row

Use the same entitlement source as membership checks. Keep revoked devices out of the count.

- [ ] **Step 4: Re-run the device-limit tests**

Run:

```bash
bun run test tests/devices-plan-limits.test.ts
bun run test tests/admin-device-management-routes.test.ts
bun run test tests/device-bootstrap-routes.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit the device guards**

```bash
git add convex/devices.js tests/devices-plan-limits.test.ts tests/admin-device-management-routes.test.ts tests/device-bootstrap-routes.test.ts
git commit -m "feat(billing): enforce workspace device limits"
```

## Task 6: Enforce Premium Settings and Report Export with Direct Convex Coverage

**Files:**
- Modify: `convex/settings.js`
- Modify: `convex/reports.js`
- Modify: `lib/api-error.ts`
- Modify: `lib/client-error.ts`
- Create: `tests/settings-plan-gates.test.ts`
- Modify: `tests/security-auth-rbac.test.ts`
- Modify: `tests/reports-convex.test.ts`
- Modify: `tests/admin-reports-download-route.test.ts`
- Modify: `tests/api-error.test.ts`

- [ ] **Step 1: Write the failing direct premium-gate tests**

Add direct `settings:update` coverage for:
- free workspace cannot enable `geofence`
- free workspace cannot enable `whitelist`
- free workspace cannot submit `attendanceSchedule`

Add direct `reports:getDownloadUrl` coverage for:
- free workspace cannot resolve a report download URL

Example expectation:

```ts
await expect(
  update.handler(ctx as never, {
    workspaceId: "workspace_123456" as never,
    geofenceEnabled: true,
  }),
).rejects.toMatchObject({
  data: {
    code: "FEATURE_NOT_AVAILABLE",
    message: expect.stringMatching(/Pro/i),
  },
});
```

Then keep the route tests focused on preserving the error code and message over HTTP.

- [ ] **Step 2: Run the premium-feature tests**

Run:

```bash
bun run test tests/settings-plan-gates.test.ts
bun run test tests/security-auth-rbac.test.ts
bun run test tests/reports-convex.test.ts
bun run test tests/admin-reports-download-route.test.ts
```

Expected: FAIL because premium guards do not exist yet.

- [ ] **Step 3: Implement premium-only settings checks**

In `convex/settings.js`, allow non-premium fields to keep working, but block premium capability changes:
- reject `geofenceEnabled: true` when `features.geofence === false`
- reject `whitelistEnabled: true` when `features.ipWhitelist === false`
- reject any provided `attendanceSchedule` when `features.attendanceSchedule === false`

- [ ] **Step 4: Implement premium report-export checks**

In `convex/reports.js`, resolve workspace entitlements before `ctx.db.get(args.reportId)` and throw `FEATURE_NOT_AVAILABLE` for free.

- [ ] **Step 5: Re-run the premium-feature tests**

Run:

```bash
bun run test tests/settings-plan-gates.test.ts
bun run test tests/security-auth-rbac.test.ts
bun run test tests/reports-convex.test.ts
bun run test tests/admin-reports-download-route.test.ts
```

Expected: PASS

- [ ] **Step 6: Update shared HTTP and client error mappers**

In `lib/api-error.ts`:
- map `PLAN_LIMIT_REACHED` to `409`
- map `FEATURE_NOT_AVAILABLE` to `403`
- map `WORKSPACE_PLAN_INVALID` to `400`

In `tests/api-error.test.ts`:
- add one case per new code so route behavior is enforced through the shared mapper

In `lib/client-error.ts`:
- add user-facing messages for:
  - `PLAN_LIMIT_REACHED`
  - `FEATURE_NOT_AVAILABLE`
  - `WORKSPACE_PLAN_INVALID`

- [ ] **Step 7: Re-run the premium-feature and mapper tests**

Run:

```bash
bun run test tests/settings-plan-gates.test.ts
bun run test tests/security-auth-rbac.test.ts
bun run test tests/reports-convex.test.ts
bun run test tests/admin-reports-download-route.test.ts
bun run test tests/api-error.test.ts
```

Expected: PASS

- [ ] **Step 8: Commit the premium feature gates**

```bash
git add convex/settings.js convex/reports.js lib/api-error.ts lib/client-error.ts tests/settings-plan-gates.test.ts tests/security-auth-rbac.test.ts tests/reports-convex.test.ts tests/admin-reports-download-route.test.ts tests/api-error.test.ts
git commit -m "feat(billing): gate premium workspace features"
```

## Task 7: Add Invite Expiry Management Gated by Plan

**Files:**
- Modify: `convex/workspaces.js`
- Modify: `app/api/admin/workspace/route.ts`
- Modify: `components/dashboard/workspace-panel.tsx`
- Modify: `tests/admin-workspace-route.test.ts`
- Modify: `tests/workspaces-subscription.test.ts`

- [ ] **Step 1: Write the failing invite-expiry tests**

Cover these cases:
- free workspace cannot set invite expiry
- pro workspace can set a new expiry timestamp on the active invite code
- superadmin can clear expiry back to `undefined`

At the route layer, validate a payload like:

```ts
{
  action: "updateInviteExpiry",
  expiresAt: 1_900_000_000_000,
}
```

- [ ] **Step 2: Run the invite-expiry tests**

Run:

```bash
bun run test tests/workspaces-subscription.test.ts
bun run test tests/admin-workspace-route.test.ts
```

Expected: FAIL because there is no invite-expiry action yet.

- [ ] **Step 3: Implement the invite-expiry mutation and route action**

In `convex/workspaces.js`:
- add a mutation like `updateActiveInviteExpiry`
- require `superadmin`
- require `features.inviteExpiry === true`
- patch the currently active invite code’s `expiresAt`

In `app/api/admin/workspace/route.ts`:
- accept `action: "updateInviteExpiry"`
- allow `expiresAt: number | null`
- map `null` to clearing expiry

- [ ] **Step 4: Add the smallest UI control in the workspace panel**

In `components/dashboard/workspace-panel.tsx`:
- add a compact expiry selector near the invite-code controls
- use simple presets only:
  - `Tidak kedaluwarsa`
  - `1 hari`
  - `7 hari`
  - `30 hari`
- disable the selector on free and show `Pro` copy

- [ ] **Step 5: Re-run the invite-expiry tests**

Run:

```bash
bun run test tests/workspaces-subscription.test.ts
bun run test tests/admin-workspace-route.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit the invite-expiry work**

```bash
git add convex/workspaces.js app/api/admin/workspace/route.ts components/dashboard/workspace-panel.tsx tests/admin-workspace-route.test.ts tests/workspaces-subscription.test.ts
git commit -m "feat(billing): gate invite expiry by plan"
```

## Task 8: Add Client-Side Soft Gates with Shared Entitlement Refresh

**Files:**
- Create: `lib/workspace-subscription-client.ts`
- Modify: `components/dashboard/workspace-panel.tsx`
- Modify: `components/dashboard/geofence-panel.tsx`
- Modify: `components/dashboard/device-management-panel.tsx`
- Modify: `components/dashboard/report-panel.tsx`
- Create: `tests/workspace-plan-ui.test.ts`

- [ ] **Step 1: Write failing tests for the derived UI state**

If these surfaces still lack stable component tests, extract and test pure helper behavior instead of snapshotting entire pages.

Target helper behaviors:
- plan badge text for `free`, `pro`, `enterprise`
- member usage copy like `3 / 5 member aktif`
- device gate copy when `activeDevices === maxDevicesPerWorkspace`
- report export disabled when `features.reportExport === false`
- geofence premium banner when `features.geofence === false`
- attendance schedule save disabled when `features.attendanceSchedule === false`

- [ ] **Step 2: Run the UI helper test**

Run: `bun run test tests/workspace-plan-ui.test.ts`

Expected: FAIL because the helper and plan-specific UI behavior do not exist yet.

- [ ] **Step 3: Implement the shared client entitlement loader**

Create `lib/workspace-subscription-client.ts` with one shared helper or hook that:
- fetches `/api/workspaces/current` via `workspaceFetch`, not plain `fetch`
- refreshes on mount
- refreshes on `workspace:changed`
- refreshes on `dashboard:refresh`

Do not duplicate four separate fetch-on-mount implementations.

- [ ] **Step 4: Wire all dashboard panels to the shared helper**

In `components/dashboard/workspace-panel.tsx`:
- render the current plan badge
- render member usage and device usage from `subscription.usage`
- disable attendance schedule save and show `Pro` copy when `attendanceSchedule` is unavailable

In `components/dashboard/geofence-panel.tsx`:
- show a premium banner when `geofence` is unavailable
- disable the geofence and whitelist toggles plus save button when unavailable

In `components/dashboard/device-management-panel.tsx`:
- disable `Generate code` when the active device count has reached the limit
- show a notice like `Plan workspace ini sudah mencapai batas device aktif`

In `components/dashboard/report-panel.tsx`:
- disable `Unduh` buttons when `reportExport` is unavailable
- show inline copy that export belongs to Pro

Keep soft gates additive. Existing server-side hard gates remain authoritative.

- [ ] **Step 5: Re-run the UI helper test**

Run: `bun run test tests/workspace-plan-ui.test.ts`

Expected: PASS

- [ ] **Step 6: Commit the UI gating work**

```bash
git add lib/workspace-subscription-client.ts components/dashboard/workspace-panel.tsx components/dashboard/geofence-panel.tsx components/dashboard/device-management-panel.tsx components/dashboard/report-panel.tsx tests/workspace-plan-ui.test.ts
git commit -m "feat(billing): add workspace plan soft gates"
```

## Task 9: Run Focused Verification and Finish the Rollout

**Files:**
- No code changes expected unless verification reveals regressions

- [ ] **Step 1: Run the focused subscription test suite**

Run:

```bash
bun run test tests/workspace-plan-entitlements.test.ts
bun run test tests/workspaces-subscription.test.ts
bun run test tests/devices-plan-limits.test.ts
bun run test tests/settings-plan-gates.test.ts
bun run test tests/workspace-current-route.test.ts
bun run test tests/admin-workspace-route.test.ts
bun run test tests/workspace-routes.test.ts
bun run test tests/admin-routes-workspace-policy.test.ts
bun run test tests/admin-device-management-routes.test.ts
bun run test tests/device-bootstrap-routes.test.ts
bun run test tests/security-auth-rbac.test.ts
bun run test tests/reports-convex.test.ts
bun run test tests/admin-reports-download-route.test.ts
bun run test tests/api-error.test.ts
bun run test tests/workspace-plan-ui.test.ts
```

Expected: all PASS

- [ ] **Step 2: Run broad safety checks**

Run:

```bash
bun run lint
bun run test
```

Expected: PASS, or only clearly documented unrelated pre-existing failures

- [ ] **Step 3: Fix any regressions with the smallest follow-up change**

If a check fails:
- add or update the failing test first where practical
- make the smallest code correction
- rerun only the failing slice, then rerun the full verification block

- [ ] **Step 4: Commit the verified rollout**

```bash
git add convex/plans.js convex/schema.js convex/workspaces.js convex/users.js convex/devices.js convex/settings.js convex/reports.js app/api/admin/workspace/route.ts app/api/workspaces/current/route.ts lib/api-error.ts lib/client-error.ts lib/workspace-subscription-client.ts types/dashboard.ts components/dashboard/workspace-panel.tsx components/dashboard/geofence-panel.tsx components/dashboard/device-management-panel.tsx components/dashboard/report-panel.tsx tests/workspace-plan-entitlements.test.ts tests/workspaces-subscription.test.ts tests/devices-plan-limits.test.ts tests/settings-plan-gates.test.ts tests/workspace-current-route.test.ts tests/workspace-plan-ui.test.ts tests/admin-workspace-route.test.ts tests/workspace-routes.test.ts tests/admin-routes-workspace-policy.test.ts tests/admin-device-management-routes.test.ts tests/device-bootstrap-routes.test.ts tests/security-auth-rbac.test.ts tests/reports-convex.test.ts tests/admin-reports-download-route.test.ts tests/api-error.test.ts
git commit -m "feat(billing): add workspace subscription enforcement"
```
