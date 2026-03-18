# Dev Console Design

## Summary

Add a new internal-only `/dev` area that acts as a global developer control room for `absenin.id`.

The purpose of `/dev` is different from the existing workspace-scoped dashboard:

- existing dashboard pages are tenant-scoped and role-scoped (`admin`, `superadmin`, `karyawan`, `device-qr`)
- `/dev` is a root-level internal console for the project owner/developer
- `/dev` must allow global visibility across all workspaces and users
- `/dev` must support risky recovery and maintenance mutations because it is intended as the fastest place to repair production issues

The approved layout direction is **Mission Control**:

- top-level global overview first
- strong filtering and navigation in the left rail
- large central work area for global lists and inspection
- right-side context panel for detail and dangerous actions
- explicit auditability for every important mutation

## Goals

- Create a dedicated `/dev` experience for the developer to inspect and manage the whole application.
- Keep `/dev` separate from the existing workspace dashboard and its membership rules.
- Support these v1 modules as fully usable surfaces:
  - global overview
  - workspace management
  - user management
  - plan management
- Allow risky mutations in `/dev` because the console is intended for recovery and operational repair.
- Gate access through Clerk plus an internal second-layer unlock flow.
- Ensure every important mutation in `/dev` is auditable.

## Non-Goals

- Replace or redesign the existing `/dashboard` and `/settings` surfaces.
- Merge `/dev` into existing workspace-scoped admin APIs.
- Build a general-purpose backoffice for non-developer operators.
- Ship full subscription-history integration in v1.
- Build a v1 command palette or arbitrary quick-action framework.
- Introduce broad product-wide role changes for existing tenant users.

## Current State

The repository already has several strong admin/workspace patterns, but they are tenant-scoped:

- page auth flows in `lib/auth.ts`
- workspace-scoped admin routes in `app/api/admin/**`
- workspace management UI in `components/dashboard/workspace-panel.tsx`
- workspace/user views in `components/dashboard/users-panel.tsx`
- dashboard shell and role-aware navigation in `components/dashboard/layout.tsx` and `components/dashboard/navigation-config.ts`

These current flows rely on:

- Clerk authentication
- Convex-backed app user records
- active workspace context and membership lookup
- role checks such as `requireWorkspaceRolePageFromDb()` and `requireWorkspaceRoleApiFromDb()`

That model is correct for tenant-facing product surfaces, but it is the wrong abstraction for `/dev`, which must operate across all workspaces without depending on `x-workspace-id` or active workspace cookies.

## Research Notes

The external references reviewed for this design pointed in the same direction:

- internal control panels should separate broad overview from dangerous actions
- destructive mutations should be contextual, deliberate, and auditable
- access control for sensitive console surfaces should be layered and explicit

Relevant references:

- Supabase platform audit logs:
  - [https://supabase.com/docs/guides/security/platform-audit-logs](https://supabase.com/docs/guides/security/platform-audit-logs)
- Supabase access control:
  - [https://supabase.com/docs/guides/platform/access-control](https://supabase.com/docs/guides/platform/access-control)
- Clerk admin dashboard glossary:
  - [https://clerk.com/glossary/admin-dashboard](https://clerk.com/glossary/admin-dashboard)

The COSS UI guidance also confirms the local component stack preference:

- [https://coss.com/ui/llms.txt](https://coss.com/ui/llms.txt)

## Target Experience

### Product Positioning

`/dev` should feel like a root console, not like another workspace page with elevated role access.

The experience should communicate:

- internal-only
- global scope
- operational visibility
- safe but powerful mutation capability

The surface is meant for the project developer using special credentials and should not reuse the same information architecture as the tenant-facing dashboard.

### Access Model

Access to `/dev` is approved as a hybrid layered model:

1. Clerk authentication is required.
2. Clerk `publicMetadata.devAccess === true` is required.
3. A second unlock step with special internal credentials is required for `/dev`.

This means a signed-in Clerk user is still denied `/dev` unless they also:

- carry the internal metadata flag
- successfully complete the second unlock flow

The second unlock contract for v1 is intentionally narrow:

- credential type:
  - one environment-backed internal passphrase validated server-side
- storage:
  - short-lived signed `httpOnly` cookie scoped to `/dev`
- TTL:
  - 30 minutes sliding session
- failure handling:
  - after 5 failed unlock attempts for the same session or IP fingerprint, block additional attempts for 15 minutes
- invalidation:
  - logout clears the `/dev` unlock cookie immediately
  - changing the server-side passphrase invalidates future unlock attempts until the new passphrase is used
  - expired or invalid signatures force return to `/dev/login`

This unlock layer is for internal defense-in-depth and should not attempt to replace Clerk session management.

### Layout Direction

The approved visual and structural direction is **Mission Control**.

The page should be organized into four functional layers:

1. **Header bar**
   - `Developer Console` identity
   - global-scope badge
   - session status badges
   - refresh and logout actions only

2. **Top overview strip**
   - global KPI cards
   - attention-needed / anomaly summary

3. **Main mission-control grid**
   - left rail: navigator and filters
   - center: primary work area
   - right rail: context and actions

4. **Utility lanes**
   - recent mutations
   - risk queue
   - future audit and subscription-history surfaces

This structure keeps the page useful both for broad monitoring and for jumping quickly into repair actions.

The v1 header explicitly does **not** include:

- command palette
- arbitrary quick actions
- global freeform search spanning every module

Those can be revisited later once the base console is working.

### V1 Risk Taxonomy

All overview cards, risk filters, and the risk queue must use the same explicit risk codes in v1.

Approved v1 risk codes:

- `workspace_inactive`
  - workspace exists but `isActive === false`
- `workspace_without_active_superadmin`
  - workspace has no active membership with role `superadmin`
- `invite_expiring_24h`
  - workspace has an active invite code that expires within 24 hours
- `plan_limit_reached`
  - workspace member or device usage has reached its current plan limit
- `user_inactive_with_active_membership`
  - user is inactive but still has one or more active memberships
- `identity_sync_mismatch`
  - Clerk identity and app/Convex identity are out of sync in one of the explicitly supported ways defined in User Management below

Rules:

- `at-risk counts` on overview cards are counts of records matching one or more of these risk codes
- `Attention Needed` is the top-priority subset of these same risk codes
- `risk queue` is a list view of records tagged with these same risk codes
- workspace filters and user filters may filter by one or more of these same risk codes

## Information Architecture

### `/dev`

Default landing page for the console.

Responsibilities:

- present global overview metrics
- present anomaly and risk signals
- act as the main switching surface into workspaces, users, and plans

### `/dev/login`

Second-layer unlock page after Clerk auth succeeds.

Responsibilities:

- explain that `/dev` is an internal-only surface
- accept the internal unlock credential
- establish a short-lived `/dev` session

This is not a user-sign-in replacement. It is an unlock step layered on top of Clerk.

### Main View Modes Inside `/dev`

The central work area should support at least these modes in v1:

- `Overview`
- `Workspaces`
- `Users`
- `Plans`

The switch between these modes can be tabs, segmented controls, or a mission-control selector, but the overall page should remain one coherent console rather than four disconnected pages.

## Module Design

### 1. Global Overview

This module is the default focus on entering `/dev`.

It should show:

- total workspaces
- active workspaces
- inactive workspaces
- total users
- active users
- inactive users
- plan distribution summary
- at-risk counts

It should also include:

- `Attention Needed` summary card or rail
- `Recent Mutations` feed
- quick links into filtered workspace or user lists

In v1, `Attention Needed` and `at-risk counts` are derived only from the approved v1 risk taxonomy. There is no separate hidden risk scoring system.

This module should answer:

- what looks broken right now?
- what needs attention first?
- where should the developer click next?

### 2. Workspace Management

This module is the global workspace inventory.

It should support:

- search across all workspaces
- filter by plan
- filter by active/inactive state
- filter by one or more approved risk codes
- select a workspace and inspect details in the context rail

Detail context should surface:

- workspace name
- slug
- status
- created date
- owner/superadmin summary
- active invite state
- member/device usage summary
- plan summary

Approved v1 mutations:

- rename workspace
- activate/deactivate workspace
- rotate invite code
- update invite expiry
- change workspace plan
- delete workspace

Delete workspace is especially risky and should use stronger confirmation than standard mutations.

For v1, `delete workspace` means **soft delete only**:

- set workspace inactive
- revoke or disable active invite codes for that workspace
- prevent further device or member activity through normal workspace flows
- preserve workspace record, memberships, devices, invites, and audit history for investigation
- do not hard-delete users
- do not hard-delete historical attendance or audit data

Hard delete is explicitly out of scope for v1 `/dev`.

### 3. User Management

This module is the global user inventory across the whole application.

It should support:

- search by name or email
- filter by active/inactive status
- filter by role or membership state
- inspect a single user and see their memberships across workspaces

Detail context should surface:

- Clerk identity
- app/Convex identity
- active status
- memberships across workspaces
- role spread
- sync mismatch indicators if present

Approved v1 mutations:

- activate/deactivate user
- adjust workspace membership role
- perform one of the explicitly allowed repair actions below

This module is intended to help recover bad data or access problems quickly, not just to browse user records.

Supported v1 identity/membership mismatch cases:

- Clerk user exists but app user record is missing
- Clerk primary identity fields differ from stored app user name/email
- inactive app user still has active memberships
- membership role is incorrect for the intended workspace access

Allowed v1 repair actions:

- trigger Clerk-to-app resync for a selected user
- activate or deactivate the app user
- change a membership role
- deactivate a membership

Out of scope in v1:

- deleting users
- merging users
- reassigning historical records between users
- bulk repair flows

### 4. Plan Management

This module is global plan visibility plus plan mutation.

It should support:

- plan distribution overview
- filter workspaces by current plan
- inspect the plan state of a selected workspace
- change a workspace plan

It should also include a **frontend-only placeholder** for subscription history in v1 with copy that clearly indicates the integration is coming later.

The placeholder is acceptable because the approved scope explicitly allows `history subscription` to be frontend-only for now.

## Component Architecture

Recommended boundaries:

- `app/dev/page.tsx`
- `app/dev/login/page.tsx`
- a dedicated `/dev` shell layout that is not based on `(dashboard)` membership flow
- `components/dev/*` for console-specific UI
- `lib/dev-auth.ts` for `/dev` access and unlock helpers
- `lib/dev-*` helpers for parsing filters, mutations, and view state

Recommended UI units:

- `DevShell`
- `DevHeader`
- `DevOverviewCards`
- `DevRiskQueue`
- `DevRecentMutations`
- `DevNavigator`
- `DevWorkspaceTable`
- `DevUserTable`
- `DevPlanPanel`
- `DevContextPanel`
- `DevDangerZone`

These units should remain focused so each one is understandable and testable in isolation.

The existing dashboard shell and sidebar components should not be overloaded to serve `/dev`. Reusing low-level UI primitives is fine, but the console should own its own layout and interaction boundaries.

## Auth and Session Design

### Why a Separate Guard Is Needed

Current auth helpers in `lib/auth.ts` are built around:

- app roles
- workspace membership
- active workspace context

`/dev` requires a separate root-console guard because:

- it must not require workspace membership
- it must not depend on `x-workspace-id`
- it must not accidentally inherit tenant-facing permissions

### Recommended Guard Shape

Introduce a `/dev`-specific guard, conceptually:

- require signed-in Clerk user
- read Clerk user metadata
- enforce `publicMetadata.devAccess === true`
- enforce a valid `/dev` unlock session cookie or token

Suggested helpers:

- `getDevAccessSession()`
- `requireDevAccessPage()`
- `requireDevAccessApi()`
- `validateDevUnlock()`
- `createDevUnlockSession()`
- `clearDevUnlockSession()`

### `/dev/login` Session Behavior

`/dev/login` should:

- reject access if Clerk auth is missing
- reject access if `publicMetadata.devAccess !== true`
- accept the internal unlock credential
- create a short-lived session used only for `/dev`

The unlock session should be clearly separate from normal app auth and should be easy to expire or rotate.

The unlock cookie should be:

- `httpOnly`
- `secure` in production
- scoped to `/dev`
- signed server-side

Unlock and logout events may be logged for diagnostics, but they are not part of the blocking mutation-audit requirement below.

## API Design

### Separate Namespace

`/dev` should not reuse `app/api/admin/**` routes because those endpoints are workspace-scoped and intentionally tied to tenant membership rules.

Instead, create a dedicated namespace:

- `app/api/dev/**`

This namespace should support global queries and global mutations.

### Expected v1 API Areas

- `GET /api/dev/overview`
- `GET /api/dev/workspaces`
- `PATCH /api/dev/workspaces/:id`
- `POST /api/dev/workspaces/:id/actions`
- `GET /api/dev/users`
- `PATCH /api/dev/users/:id`
- `PATCH /api/dev/memberships/:id`
- `GET /api/dev/plans`
- `PATCH /api/dev/workspaces/:id/plan`
- `GET /api/dev/mutations`
- `POST /api/dev/unlock`
- `POST /api/dev/logout`

Exact route shapes can change during implementation, but the key rule is that they must remain rooted in `/api/dev` and protected by `/dev` access guards.

### V1 HTTP Contracts

These contracts are intentionally minimal but specific enough for planning.

#### `GET /api/dev/overview`

Response shape:

- `kpis`
  - workspace totals
  - user totals
  - plan distribution totals
  - risk totals by approved risk code
- `attention`
  - top risk buckets using the approved risk taxonomy
- `recentMutations`
  - latest audit-backed mutation entries

#### `GET /api/dev/workspaces`

Query params:

- `q`
- `status` = `active | inactive | all`
- `plan`
- `risk`
- `cursor`
- `limit`
- `sort` = `createdAt | updatedAt | name`

Response shape:

- `rows`
- `summary`
- `pageInfo`

Each workspace row should contain enough data for:

- identity
- status
- plan snapshot
- usage snapshot
- applied risk codes

#### `PATCH /api/dev/workspaces/:id`

Allowed payload families:

- rename workspace
- activate/deactivate workspace
- update invite expiry
- change plan

Use explicit action-oriented payload validation rather than loosely typed partial updates.

#### `POST /api/dev/workspaces/:id/actions`

Allowed v1 actions:

- rotate invite code
- soft delete workspace

#### `GET /api/dev/users`

Query params:

- `q`
- `status` = `active | inactive | all`
- `role`
- `risk`
- `cursor`
- `limit`
- `sort` = `createdAt | updatedAt | name`

Response shape:

- `rows`
- `summary`
- `pageInfo`

Each user row should contain enough data for:

- identity
- status
- membership summary
- applied risk codes

#### `PATCH /api/dev/users/:id`

Allowed payload families:

- activate/deactivate user
- trigger resync for selected user

#### `PATCH /api/dev/memberships/:id`

Allowed payload families:

- change membership role
- deactivate membership

#### `GET /api/dev/plans`

Response shape:

- `distribution`
- `rows`
- `summary`

#### `GET /api/dev/mutations`

Query params:

- `targetType`
- `action`
- `cursor`
- `limit`

Response shape:

- `rows`
- `pageInfo`

### Route Handler vs Convex Boundary

For v1, Next route handlers in `app/api/dev/**` should own:

- `/dev` auth validation
- query parsing
- body validation
- HTTP response shaping

Convex functions should own:

- global data reads
- mutation execution
- audit persistence
- consistency checks on domain rules

### Data Access Expectations

The data layer for `/dev` must operate globally:

- list all workspaces
- list all users
- inspect memberships across workspaces
- read and update plan state globally

This may require new Convex functions or global service-layer wrappers rather than direct reuse of current workspace-scoped functions.

## Dangerous Mutations and Guardrails

Risky actions are allowed in `/dev`, but the surface should still enforce discipline.

### General Rules

- all mutations happen server-side
- all mutations require `/dev` auth guard
- all mutations must show clear impact context
- all mutations must refresh the affected panels after success
- all important mutations must create audit records

For v1, `important mutations` means every state-changing action in these approved sets:

- workspace rename
- workspace activate/deactivate
- invite rotation
- invite expiry update
- workspace plan change
- workspace soft delete
- user activate/deactivate
- user resync trigger
- membership role change
- membership deactivation

### Confirmation Rules

Standard risky mutations:

- confirm with modal or confirmation dialog
- include target name and action summary

Very risky mutations such as delete workspace:

- require stronger confirmation, preferably typed confirmation text
- show consequences in explicit copy

### Context Placement

Dangerous actions should live in the right-side context panel or dedicated danger area, not scattered inline across table rows.

That keeps the main table focused on browsing and keeps destructive intent deliberate.

## Audit Trail

Every important `/dev` mutation should record an audit event.

Minimum recommended fields:

- `actorClerkUserId`
- `actorEmail`
- `action`
- `targetType`
- `targetId`
- `targetLabel`
- `before`
- `after`
- `status`
- `reason`
- `timestamp`

The right shape of storage can be decided during implementation, but auditability is a hard requirement for the design.

The `Recent Mutations` utility lane on `/dev` should read from this audit source or a close equivalent.

### Audit Failure Semantics

For the important mutations listed above, v1 should fail closed:

- if the domain mutation succeeds but the audit write fails, the overall request should be treated as failed
- the implementation should prefer atomic mutation-plus-audit behavior when the data layer allows it

Read-only requests do not depend on audit writes.

Unlock and logout events may use best-effort logging because they are not domain mutations.

## UX State Rules

### Empty States

Use specific empty states:

- no matching workspaces
- no matching users
- no risky items currently detected
- subscription history not yet integrated

Avoid generic blank containers.

### Error States

Differentiate these error classes:

- Clerk auth missing
- metadata access denied
- `/dev` unlock missing or expired
- data loading failure
- mutation failure

The UI copy should tell the developer whether the problem is:

- authorization
- session expiry
- backend failure
- invalid input

### Loading States

Loading states should be localized:

- overview cards can skeleton independently
- tables can refresh independently
- context panel can update independently
- mutations should show row/panel-specific pending feedback

The whole console should not blank out for small local refreshes.

## Testing

Add or update tests for:

- `/dev` page access denied when Clerk user is missing
- `/dev` page access denied when `publicMetadata.devAccess` is not true
- `/dev/login` unlock flow success and failure
- `/dev/login` temporary lockout after repeated failed unlock attempts
- `/api/dev/*` denial when the `/dev` unlock session is missing
- global overview rendering
- overview risk counts derived from the approved risk taxonomy only
- workspace list filtering
- workspace risk filtering using approved risk codes
- user list filtering
- user risk filtering using approved risk codes
- plan panel rendering
- dangerous action confirmation flows
- workspace soft delete semantics
- user resync action handling
- mutation success refresh behavior
- mutation failure handling
- audit failure causes important mutations to fail
- subscription-history placeholder rendering

If audit storage is introduced during implementation, add tests that verify audit records are written for important mutations.

## Acceptance Criteria

- `/dev` exists as a separate internal console surface.
- `/dev` is not gated by tenant workspace membership rules.
- `/dev` requires Clerk auth.
- `/dev` additionally requires `publicMetadata.devAccess === true`.
- `/dev` additionally requires a second unlock step through `/dev/login`.
- `/dev` unlock uses a short-lived signed cookie scoped to `/dev`.
- The approved Mission Control structure is reflected in the page layout.
- The v1 header does not require a command palette or arbitrary quick-action system.
- Global Overview is usable in v1.
- Workspace Management is usable in v1.
- User Management is usable in v1.
- Plan Management is usable in v1.
- Subscription history appears as frontend-only placeholder content in v1.
- Risky mutations are possible from `/dev`.
- All overview risk counts and filters use the approved v1 risk taxonomy.
- Important `/dev` mutations create audit records.
- Important `/dev` mutations fail if audit persistence fails.
- Destructive actions are contextual and explicitly confirmed.
- Workspace delete in v1 is soft delete only.
- `/api/dev/*` exists as a separate protected namespace rather than reusing workspace-scoped admin routes.

## Implementation Notes

Recommended implementation order:

1. add `/dev` auth/session helpers
2. add `/dev/login` unlock flow
3. add `/api/dev` protected namespace
4. build `/dev` shell and mission-control layout
5. ship global overview
6. ship workspace management
7. ship user management
8. ship plan management
9. add mutation audit trail wiring
10. polish empty/error/loading states and tests

The implementation plan can decide whether overview and tables share one page-level controller or use smaller independently fetched islands. The architectural constraint is not the exact hook structure; it is that the console must remain globally scoped, auditable, and clearly separated from tenant-facing admin flows.
