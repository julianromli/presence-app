# Workspace Attendance Schedule Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-day workspace check-in schedule settings and use them to classify employee arrivals as on-time or late.

**Architecture:** Extend the existing workspace `settings` document with a weekly `attendanceSchedule` array, expose it through the existing admin settings API, and replace the current fixed punctuality cutoff with schedule-aware helper functions. Keep attendance progress status separate from punctuality status so current admin attendance flows remain stable.

**Tech Stack:** Next.js 16 App Router, React 19, Convex, TypeScript, Vitest, COSS UI time picker

---

### Task 1: Add schedule helper tests first

**Files:**
- Create: `tests/attendance-schedule.test.ts`
- Reference: `convex/employeeDashboardKpi.js`

**Step 1: Write the failing test**

Add tests that define the expected schedule behavior:

```ts
import { describe, expect, it } from 'vitest';

import {
  defaultAttendanceSchedule,
  getScheduleForDateKey,
  parseClockToMinutes,
  resolveCheckInPunctuality,
} from '../convex/employeeDashboardKpi';

describe('attendance schedule helpers', () => {
  it('returns the matching enabled row for a weekday', () => {
    const row = getScheduleForDateKey('2026-03-09', defaultAttendanceSchedule());
    expect(row?.day).toBe('monday');
    expect(row?.enabled).toBe(true);
  });

  it('parses HH:mm into minutes', () => {
    expect(parseClockToMinutes('08:15')).toBe(495);
  });

  it('marks check-in on time when local minutes are before or equal to schedule', () => {
    const checkInAt = new Date('2026-03-09T00:59:00.000Z').getTime();
    const result = resolveCheckInPunctuality({
      dateKey: '2026-03-09',
      checkInAt,
      timezone: 'Asia/Jakarta',
      schedule: defaultAttendanceSchedule(),
    });
    expect(result).toBe('on-time');
  });

  it('marks check-in late when local minutes are after schedule', () => {
    const checkInAt = new Date('2026-03-09T01:30:00.000Z').getTime();
    const result = resolveCheckInPunctuality({
      dateKey: '2026-03-09',
      checkInAt,
      timezone: 'Asia/Jakarta',
      schedule: defaultAttendanceSchedule(),
    });
    expect(result).toBe('late');
  });

  it('returns not-applicable for disabled days', () => {
    const checkInAt = new Date('2026-03-08T01:30:00.000Z').getTime();
    const result = resolveCheckInPunctuality({
      dateKey: '2026-03-08',
      checkInAt,
      timezone: 'Asia/Jakarta',
      schedule: defaultAttendanceSchedule(),
    });
    expect(result).toBe('not-applicable');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test tests/attendance-schedule.test.ts`
Expected: FAIL because the new schedule helpers do not exist yet.

**Step 3: Write minimal implementation**

Add minimal helper exports in `convex/employeeDashboardKpi.js`:
- `defaultAttendanceSchedule`
- `parseClockToMinutes`
- `getScheduleForDateKey`
- `resolveCheckInPunctuality`

Implement only enough logic to satisfy the tests.

**Step 4: Run test to verify it passes**

Run: `bun run test tests/attendance-schedule.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/attendance-schedule.test.ts convex/employeeDashboardKpi.js
git commit -m "test: add attendance schedule helper coverage"
```

### Task 2: Extend Convex settings schema and defaults

**Files:**
- Modify: `convex/schema.js`
- Modify: `convex/helpers.js`
- Modify: `convex/workspaces.js`
- Modify: `convex/settings.js`
- Test: `tests/security-auth-rbac.test.ts`

**Step 1: Write the failing test**

Add assertions that settings payloads now include `attendanceSchedule` and that existing ensure flows return default weekly values.

Example expectation:

```ts
expect(result.attendanceSchedule).toEqual([
  { day: 'monday', enabled: true, checkInTime: '08:00' },
  { day: 'tuesday', enabled: true, checkInTime: '08:00' },
  { day: 'wednesday', enabled: true, checkInTime: '08:00' },
  { day: 'thursday', enabled: true, checkInTime: '08:00' },
  { day: 'friday', enabled: true, checkInTime: '08:00' },
  { day: 'saturday', enabled: false },
  { day: 'sunday', enabled: false },
]);
```

**Step 2: Run test to verify it fails**

Run: `bun run test tests/security-auth-rbac.test.ts`
Expected: FAIL because `attendanceSchedule` is not part of the current settings shape.

**Step 3: Write minimal implementation**

Update Convex schema and settings validators to include:
- weekly row validator
- `attendanceSchedule` in `settingsValidator`
- `attendanceSchedule` in update args

Add helper-backed defaults so ensure flows always materialize the field even for old workspaces.

**Step 4: Run test to verify it passes**

Run: `bun run test tests/security-auth-rbac.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/schema.js convex/helpers.js convex/workspaces.js convex/settings.js tests/security-auth-rbac.test.ts
git commit -m "feat(settings): add default workspace attendance schedule"
```

### Task 3: Validate and expose schedule through admin settings API

**Files:**
- Modify: `app/api/admin/settings/route.ts`
- Modify: `tests/security-auth-rbac.test.ts`

**Step 1: Write the failing test**

Add API-level coverage for:
- valid `attendanceSchedule` update payload
- invalid `HH:mm` payload rejection
- enabled row without `checkInTime` rejection

Example invalid case:

```ts
const body = {
  attendanceSchedule: [
    { day: 'monday', enabled: true },
    // remaining 6 valid rows...
  ],
};
```

**Step 2: Run test to verify it fails**

Run: `bun run test tests/security-auth-rbac.test.ts`
Expected: FAIL because route payload typing and validation do not support the new field.

**Step 3: Write minimal implementation**

Extend the route body contract and pass `attendanceSchedule` through to `settings:update`.

In Convex update handling, reject:
- malformed day sets
- duplicate days
- invalid clock format
- enabled rows without a time

**Step 4: Run test to verify it passes**

Run: `bun run test tests/security-auth-rbac.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/admin/settings/route.ts convex/settings.js tests/security-auth-rbac.test.ts
git commit -m "feat(settings): validate attendance schedule updates"
```

### Task 4: Replace fixed punctuality cutoff with schedule-aware helpers

**Files:**
- Modify: `convex/employeeDashboardKpi.js`
- Modify: `convex/dashboardEmployee.js`
- Modify: `tests/employee-dashboard-kpi.test.ts`

**Step 1: Write the failing test**

Replace or extend current fixed-cutoff tests so punctuality depends on schedule rows instead of a hard-coded `08:00` constant.

Example:

```ts
expect(
  resolveCheckInPunctuality({
    dateKey: '2026-03-10',
    checkInAt: new Date('2026-03-10T02:05:00.000Z').getTime(),
    timezone: 'Asia/Jakarta',
    schedule: [
      { day: 'tuesday', enabled: true, checkInTime: '09:00' },
      // remaining days...
    ],
  }),
).toBe('on-time');
```

**Step 2: Run test to verify it fails**

Run: `bun run test tests/employee-dashboard-kpi.test.ts`
Expected: FAIL because the KPI helper still relies on the old fixed cutoff path.

**Step 3: Write minimal implementation**

Refactor `convex/employeeDashboardKpi.js`:
- keep generic time extraction helpers
- stop using the fixed cutoff as the primary punctuality rule
- expose schedule-aware punctuality resolution

Update `convex/dashboardEmployee.js` to pull `attendanceSchedule` from workspace settings and route all punctuality decisions through the new helper.

**Step 4: Run test to verify it passes**

Run: `bun run test tests/employee-dashboard-kpi.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/employeeDashboardKpi.js convex/dashboardEmployee.js tests/employee-dashboard-kpi.test.ts
git commit -m "feat(attendance): use workspace schedule for punctuality"
```

### Task 5: Add workspace settings table UI

**Files:**
- Modify: `components/dashboard/workspace-panel.tsx`
- Modify: `app/api/admin/settings/route.ts`
- Modify: `types/dashboard.ts` if a dedicated settings payload type is introduced
- Reference: COSS UI time picker docs

**Step 1: Write the failing test**

If the repo already has component test coverage for settings panels, add a test for:
- rendering all 7 rows
- toggling a row disabled
- editing a time value
- saving the updated payload

If there is no existing component test harness for this surface, write a narrow unit test for any new payload-normalization helper extracted from the component.

**Step 2: Run test to verify it fails**

Run the relevant targeted test command.
Expected: FAIL because the workspace settings UI does not render or submit the weekly schedule yet.

**Step 3: Write minimal implementation**

In `components/dashboard/workspace-panel.tsx`:
- fetch settings from `/api/admin/settings`
- render a new `Jam Masuk Workspace` section
- show one row per weekday
- use COSS UI time picker for `Jam masuk`
- disable the time picker when the row is inactive
- submit the schedule to the existing settings API on save

Keep the table editing surface compact and aligned with existing admin panel patterns.

**Step 4: Run test to verify it passes**

Run the same targeted test command.
Expected: PASS

**Step 5: Commit**

```bash
git add components/dashboard/workspace-panel.tsx app/api/admin/settings/route.ts types/dashboard.ts
git commit -m "feat(settings): add workspace attendance schedule table"
```

### Task 6: Update punctuality-facing types and presentation helpers

**Files:**
- Modify: `lib/attendance-status.ts`
- Modify: `tests/attendance-status.test.ts`
- Modify: `types/dashboard.ts`

**Step 1: Write the failing test**

Add tests for any new punctuality helper output that needs to distinguish:
- on-time
- late
- not-applicable

Do not break the existing progress-status expectations unless the UI contract is intentionally expanded.

**Step 2: Run test to verify it fails**

Run: `bun run test tests/attendance-status.test.ts`
Expected: FAIL if the helper now needs to expose additional punctuality metadata not represented today.

**Step 3: Write minimal implementation**

Add only the smallest surface needed for UI display:
- keep progress status behavior stable
- add separate punctuality metadata if the UI needs it

Avoid collapsing both status domains into one field.

**Step 4: Run test to verify it passes**

Run: `bun run test tests/attendance-status.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/attendance-status.ts tests/attendance-status.test.ts types/dashboard.ts
git commit -m "refactor(attendance): separate punctuality from progress status"
```

### Task 7: Run focused verification and document any gaps

**Files:**
- Modify: `docs/plans/2026-03-09-workspace-attendance-schedule-design.md` only if implementation uncovers a design correction
- No code changes expected unless fixes are needed

**Step 1: Run focused tests**

Run:

```bash
bun run test tests/attendance-schedule.test.ts
bun run test tests/employee-dashboard-kpi.test.ts
bun run test tests/attendance-status.test.ts
bun run test tests/security-auth-rbac.test.ts
```

Expected: all PASS

**Step 2: Run broader safety checks**

Run:

```bash
bun run lint
bun run test
```

Expected: PASS, or documented unrelated pre-existing failures

**Step 3: Fix any regressions minimally**

If a check fails, write the failing test first where practical, then make the smallest correction.

**Step 4: Commit**

```bash
git add .
git commit -m "feat(attendance): add workspace daily check-in schedule"
```
