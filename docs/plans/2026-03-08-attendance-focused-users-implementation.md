# Attendance-Focused Users Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild `/dashboard/users` into an attendance-first daily operations workspace with light attendance editing and a secondary employee quick list, while keeping `/dashboard/report` unchanged.

**Architecture:** Keep the existing route and replace the current `UsersPanel` user-management experience with a new attendance-workspace orchestrator. Reuse existing admin attendance and admin users APIs, extract shared helpers only when they are truly generic, and keep report-specific features isolated in `ReportPanel`.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript, existing internal UI components, workspace-scoped admin REST handlers, Vitest.

---

### Task 1: Audit current contracts and define the new panel state model

**Files:**
- Modify: `D:\Projects\vibecode\presence-app\components\dashboard\users-panel.tsx`
- Inspect: `D:\Projects\vibecode\presence-app\app\api\admin\attendance\route.ts`
- Inspect: `D:\Projects\vibecode\presence-app\app\api\admin\attendance\edit\route.ts`
- Inspect: `D:\Projects\vibecode\presence-app\app\api\admin\users\route.ts`
- Inspect: `D:\Projects\vibecode\presence-app\types\dashboard.ts`

**Step 1: Write down the client state needed**

Document in code comments or local notes the required state buckets:
- attendance filters
- attendance rows
- attendance summary
- employee quick-list rows
- loading/error state per section
- edit draft state

**Step 2: Run a type-only baseline check**

Run: `bun run lint`
Expected: Existing baseline output captured before refactor starts

**Step 3: Remove stale assumptions from the current panel**

Refactor `users-panel.tsx` so the top-level state model no longer centers on role/status account management. Keep the file compiling before moving to child extraction.

**Step 4: Verify the file still compiles**

Run: `bun run lint`
Expected: No new lint errors from `users-panel.tsx`

**Step 5: Commit**

```bash
git add components/dashboard/users-panel.tsx
git commit -m "refactor(users): prepare attendance workspace state model"
```

### Task 2: Add attendance filter helpers and test them first

**Files:**
- Create: `D:\Projects\vibecode\presence-app\lib\attendance-filters.ts`
- Create: `D:\Projects\vibecode\presence-app\tests\attendance-filters.test.ts`

**Step 1: Write the failing tests**

Cover:
- default filter resolution
- search trimming
- status filter serialization
- edited/original filter serialization
- query-string generation for attendance fetches

**Step 2: Run the focused tests to verify failure**

Run: `bun run test -- tests/attendance-filters.test.ts`
Expected: FAIL because helper module does not exist yet

**Step 3: Implement the minimal helper module**

Add:
- default filter object
- normalization/resolution helper
- query-string builder for attendance requests

**Step 4: Run the focused tests**

Run: `bun run test -- tests/attendance-filters.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/attendance-filters.ts tests/attendance-filters.test.ts
git commit -m "test(attendance): add attendance filter helpers"
```

### Task 3: Add attendance status derivation helpers and test them first

**Files:**
- Create: `D:\Projects\vibecode\presence-app\lib\attendance-status.ts`
- Create: `D:\Projects\vibecode\presence-app\tests\attendance-status.test.ts`

**Step 1: Write the failing tests**

Cover:
- no check-in => not checked-in
- check-in without check-out => incomplete
- edited rows retain edited marker
- completed rows derive stable display status

**Step 2: Run the focused tests to verify failure**

Run: `bun run test -- tests/attendance-status.test.ts`
Expected: FAIL because the status helper does not exist yet

**Step 3: Implement minimal status helpers**

Create pure helpers that map attendance row shape to display status and badge metadata.

**Step 4: Run the focused tests**

Run: `bun run test -- tests/attendance-status.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/attendance-status.ts tests/attendance-status.test.ts
git commit -m "test(attendance): add attendance status helpers"
```

### Task 4: Extract the attendance command bar and KPI header

**Files:**
- Create: `D:\Projects\vibecode\presence-app\components\dashboard\attendance-workspace-header.tsx`
- Create: `D:\Projects\vibecode\presence-app\components\dashboard\attendance-workspace-filters.tsx`
- Modify: `D:\Projects\vibecode\presence-app\components\dashboard\users-panel.tsx`

**Step 1: Write the minimal component test or snapshot test if the repo already supports it**

If no component-test harness exists, document this and rely on lint + manual verification in later tasks.

**Step 2: Implement the header and sticky command bar**

Include:
- daily KPI cards
- date picker
- employee search
- attendance status filter
- edited filter
- refresh action

Do not include report-only controls.

**Step 3: Wire these into `UsersPanel`**

`UsersPanel` should own the state and pass props into the extracted components.

**Step 4: Run lint**

Run: `bun run lint`
Expected: PASS

**Step 5: Commit**

```bash
git add components/dashboard/attendance-workspace-header.tsx components/dashboard/attendance-workspace-filters.tsx components/dashboard/users-panel.tsx
git commit -m "feat(users): add attendance workspace header and filters"
```

### Task 5: Build the main attendance table with inline light editing

**Files:**
- Create: `D:\Projects\vibecode\presence-app\components\dashboard\attendance-workspace-table.tsx`
- Modify: `D:\Projects\vibecode\presence-app\components\dashboard\users-panel.tsx`

**Step 1: Write the failing test for edit-state helpers if the logic is extracted**

At minimum, cover:
- entering edit mode
- validating empty reason
- blocking check-out before check-in

Use a pure helper if needed so the behavior can be tested without a browser harness.

**Step 2: Run the focused test**

Run: `bun run test -- tests/attendance-status.test.ts tests/attendance-filters.test.ts`
Expected: Existing tests stay green before UI integration

**Step 3: Implement the attendance table**

Include:
- derived attendance status column
- inline edit controls
- confirmation step before save
- local loading/error handling for save
- pagination or “load more” behavior if supported by the API

**Step 4: Wire save behavior to `/api/admin/attendance/edit`**

Refresh only the attendance section after save.

**Step 5: Run lint and targeted tests**

Run: `bun run lint`
Run: `bun run test -- tests/attendance-filters.test.ts tests/attendance-status.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add components/dashboard/attendance-workspace-table.tsx components/dashboard/users-panel.tsx lib/attendance-status.ts tests/attendance-status.test.ts
git commit -m "feat(users): add attendance table with light edit flow"
```

### Task 6: Add the employee quick list as secondary context

**Files:**
- Create: `D:\Projects\vibecode\presence-app\components\dashboard\employee-quick-list.tsx`
- Modify: `D:\Projects\vibecode\presence-app\components\dashboard\users-panel.tsx`

**Step 1: Reuse the existing users API contract**

Keep the quick list intentionally small:
- employee name
- active status if useful
- attendance indicator for the selected date if available client-side

**Step 2: Implement independent loading/error handling**

The quick list must fail independently from the attendance table.

**Step 3: Wire employee click behavior**

Clicking an employee should filter or highlight the attendance table without changing the page mental model.

**Step 4: Run lint**

Run: `bun run lint`
Expected: PASS

**Step 5: Commit**

```bash
git add components/dashboard/employee-quick-list.tsx components/dashboard/users-panel.tsx
git commit -m "feat(users): add employee quick list context rail"
```

### Task 7: Remove or demote stale account-management UI from the users page

**Files:**
- Modify: `D:\Projects\vibecode\presence-app\components\dashboard\users-panel.tsx`
- Inspect: `D:\Projects\vibecode\presence-app\app\dashboard\users\page.tsx`

**Step 1: Remove dominant account-management affordances**

Eliminate or demote:
- role-management dropdowns
- account status toggle as the primary table action
- read-only messaging that references workspace settings as the main destination

**Step 2: Ensure the page copy reflects attendance operations**

Update text labels, headings, and empty states to reflect attendance-first behavior.

**Step 3: Run lint**

Run: `bun run lint`
Expected: PASS

**Step 4: Commit**

```bash
git add components/dashboard/users-panel.tsx app/dashboard/users/page.tsx
git commit -m "refactor(users): remove stale account management emphasis"
```

### Task 8: Add integration coverage for the new helpers and route smoke coverage

**Files:**
- Modify or Create: `D:\Projects\vibecode\presence-app\tests\dashboard-users-attendance.test.ts`
- Modify or Create: `D:\Projects\vibecode\presence-app\tests\dashboard-routing.test.ts`

**Step 1: Write failing tests**

Cover:
- attendance query builder for default daily state
- routing/authorization assumptions if test infrastructure exists
- empty and filtered states through helper-driven assertions where possible

**Step 2: Run the focused tests**

Run: `bun run test -- tests/dashboard-users-attendance.test.ts tests/dashboard-routing.test.ts`
Expected: FAIL until coverage is added

**Step 3: Implement the minimal tests and any small support helpers**

Avoid broad snapshot tests. Keep assertions behavior-focused.

**Step 4: Run all relevant tests**

Run: `bun run test -- tests/attendance-filters.test.ts tests/attendance-status.test.ts tests/dashboard-users-attendance.test.ts tests/dashboard-routing.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/attendance-filters.test.ts tests/attendance-status.test.ts tests/dashboard-users-attendance.test.ts tests/dashboard-routing.test.ts
git commit -m "test(users): cover attendance workspace behaviors"
```

### Task 9: Final verification and documentation sweep

**Files:**
- Modify if needed: `D:\Projects\vibecode\presence-app\docs\plans\2026-03-08-attendance-focused-users-design.md`
- Modify if needed: `D:\Projects\vibecode\presence-app\docs\plans\2026-03-08-attendance-focused-users-implementation.md`

**Step 1: Run full verification**

Run: `bun run lint`
Run: `bun run test`
Expected: PASS

**Step 2: Manually verify the focused UX**

Run: `bun run dev`

Check:
- `/dashboard/users` opens on the attendance workspace
- command bar stays focused on attendance controls
- inline edit works
- employee quick list remains secondary
- `/dashboard/report` still shows the broader reporting surface

**Step 3: Update docs only if behavior changed from plan**

Keep design and implementation docs aligned with the shipped result.

**Step 4: Commit**

```bash
git add docs/plans/2026-03-08-attendance-focused-users-design.md docs/plans/2026-03-08-attendance-focused-users-implementation.md
git commit -m "docs(users): finalize attendance workspace documentation"
```
