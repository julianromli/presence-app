# Fix Plan: Draft PR Hardening (RBAC, Pagination Correctness, Performance, UX Consistency)

## Summary
This plan fixes all review findings blocking merge by:
1. Closing admin authorization gaps in user mutations.
2. Making `/api/admin/users` pagination behavior logically correct under filters/search.
3. Removing unconditional full-table scans from the hot path.
4. Fixing stale-filter reset behavior in users UI.
5. Fixing UTC-based default date bug in report UI.
6. Aligning geofence navigation with current superadmin-only authorization.
7. Adding targeted tests that prove these behaviors.

The plan keeps existing route URLs and core payload shapes stable unless explicitly noted.

---

## Decisions Locked (from clarification)
- `admin` activation scope: **only `karyawan` and `device-qr`** targets.
- `/api/admin/users` summary behavior: **exact summary** even when `q` is active.

---

## Implementation Plan

## 1) Security Fix: Prevent admin lockout/DoS on privileged accounts
### Files
- `convex/users.js`
- `app/api/admin/users/route.ts`
- `components/dashboard/users-panel.tsx`

### Changes
1. Add explicit target-policy guard in `users:updateAdminManagedFields`:
   - If actor is `admin`, reject updates when target role is `admin` or `superadmin`.
   - Keep role-change permission as superadmin-only.
   - Keep mutation idempotent.
2. Add defensive check to forbid self-deactivation for all roles (recommended hardening).
3. Return clear error code/message via `ConvexError`:
   - Example code: `FORBIDDEN` with message describing target-role restriction.
4. UI guard:
   - In users table, hide/disable activate/deactivate action for forbidden targets when viewer is `admin`.
   - Keep server enforcement as source of truth.

### Acceptance
- Admin cannot toggle `isActive` for admin/superadmin.
- Superadmin can toggle all users and change roles.
- Attempted forbidden action returns 403 and user-friendly error.

---

## 2) Pagination Correctness Fix for `/api/admin/users`
### Files
- `convex/users.js`
- `types/dashboard.ts` (if needed)
- `app/api/admin/users/route.ts`

### Changes
1. Rework `users:listPaginated` to guarantee filter-first semantics:
   - `q` is applied before page slicing semantics.
   - No “empty first page while later pages contain matches” behavior.
2. Cursor strategy:
   - Keep cursor opaque string.
   - Preserve `continueCursor` + `isDone` contract.
3. Ensure role/isActive filters are applied in data source path (not only post-page JS filtering).
4. Keep response shape consumed by API route:
   - `{ rows, pageInfo, summary }` unchanged from frontend perspective.

### Acceptance
- Given matching users exist, first page returns matches (not empty due to post-page filtering).
- Paging through filtered result set is deterministic and complete.

---

## 3) Performance Fix: Remove unconditional full-table scans on every users request
### Files
- `convex/schema.js`
- `convex/users.js`
- (optional helper) `convex/helpers.js`

### Changes
1. Introduce aggregated metrics document/table for users counts (recommended):
   - Store exact counts for `total`, `active`, `inactive`, and per-role splits.
   - Update metrics transactionally in `upsertFromClerk`, `updateRole`, `updateAdminManagedFields`.
2. Use metrics for summary when `q` is empty (O(1) read path).
3. For `q` active, compute exact filtered summary through filtered result path only (not unconditional global scan).
4. Add reconciliation path:
   - One internal mutation to rebuild metrics from users table.
   - Called manually once post-deploy or automatically if metrics doc missing/corrupt.

### Acceptance
- Default users list path no longer scans whole `users` table each request.
- Summary remains exact under all filter combinations.

---

## 4) UI Bug Fix: Reset uses stale filters
### Files
- `components/dashboard/users-panel.tsx`

### Changes
1. Refactor `loadUsers` to accept explicit filter input (or an override object).
2. Reset button flow:
   - Build cleared filters object.
   - Set state with that object.
   - Call `loadUsers` with the same cleared object (no stale closure).
3. Keep current UX behavior and labels.

### Acceptance
- Clicking Reset immediately fetches unfiltered data (single click, no second submit needed).

---

## 5) Timezone Fix: Report default date key should not use UTC day
### Files
- `components/dashboard/report-panel.tsx`
- `lib/*` utility file for date key (new, pure function)
- `tests/*` for date utility

### Changes
1. Replace `toISOString().slice(0,10)` default date logic with local date key generation.
2. Extract utility function (pure, testable), e.g. `getLocalDateKey()`.
3. Keep manual date input behavior unchanged.

### Acceptance
- Around local midnight (Asia/Jakarta), default date aligns with local calendar day.

---

## 6) UX/Auth Consistency: Geofence nav visibility
### Files
- `components/dashboard/sidebar.tsx`

### Changes
1. Hide Geofence nav entry for `admin` users (superadmin-only visibility).
2. Keep route/API guards unchanged (still enforced server-side).

### Acceptance
- Admin no longer sees a nav link that always leads to forbidden flow.
- Superadmin still sees and can access geofence settings.

---

## 7) Tests and Verification

## Automated Tests to Add
1. **RBAC target guard**
   - Admin cannot toggle admin/superadmin.
   - Superadmin can toggle all.
   - Self-deactivation blocked (if implemented).
2. **Users pagination semantics**
   - Filter/search pagination returns expected first page and complete traversal.
3. **Users summary exactness**
   - Summary exact for:
     - no filter
     - role filter
     - isActive filter
     - q filter
4. **Reset behavior helper/unit**
   - Query construction after reset uses cleared filters.
5. **Local date key utility**
   - Non-UTC date boundary case.

## Existing Checks
- `npm test`
- `npm run build`

## Manual QA Matrix
1. Admin:
   - `/dashboard`, `/dashboard/report`, `/dashboard/users` accessible.
   - Cannot role-change.
   - Cannot toggle admin/superadmin status.
   - Geofence nav hidden.
2. Superadmin:
   - Full access including geofence and role/status updates.
3. Data behavior:
   - Users filter + pagination stable.
   - Reset immediately clears and reloads.
   - Report default date matches local day.

---

## Public API / Interface Impact

## No route URL changes
- `/dashboard`, `/dashboard/report`, `/dashboard/users`, `/settings/geofence` unchanged.

## `GET /api/admin/users`
- Response top-level shape remains: `{ rows, pageInfo, summary }`.
- Cursor remains opaque; client contract remains stable.
- Summary remains exact (locked requirement).

## `PATCH /api/admin/users`
- Authorization behavior tightened:
  - Admin forbidden to mutate `admin`/`superadmin` targets.
- Error responses remain in existing API error contract style.

## Types
- Keep `types/dashboard.ts` stable unless summary metadata fields are explicitly added.
- If adding summary metadata (e.g., `isExact`), update both API and frontend type in same change.

---

## Assumptions and Defaults
1. “Admin can toggle active” is interpreted as **non-privileged targets only** (`karyawan`, `device-qr`).
2. Summary must stay exact, not approximate.
3. Geofence remains superadmin-only and should not be advertised in admin nav.
4. No new user-management scope beyond these fixes (no add-user workflow in this batch).
