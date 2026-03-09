# Workspace Attendance Schedule Design

Date: 2026-03-09
Project: Presence App
Scope: Add per-day workspace check-in schedule settings so the app can classify employee arrivals as on-time or late based on workspace-defined daily check-in times.

## 1. Context and Problem

The current workspace settings flow already stores global workspace configuration in a single `settings` document. That document currently covers timezone, geofence, IP whitelist, and related attendance controls.

Employee punctuality logic does not yet use workspace-managed daily schedules. The current KPI helper relies on a fixed check-in cutoff, which means:
- every workspace effectively shares the same default punctuality threshold
- the cutoff cannot vary by weekday
- admins cannot manage arrival expectations from the workspace settings surface

The product goal is to let `superadmin` configure a check-in time per day of the week from workspace settings, then use that schedule as the source of truth when determining whether a user arrived on time or late.

Validated product decisions:
- punctuality is determined only from `jam masuk`
- `jam pulang` is out of scope
- `Belum check-in` remains a separate status
- schedule values can differ per day
- the editing UI should be a table
- time selection should use a COSS UI time picker

## 2. Product Decisions

The feature will extend the existing workspace `settings` document instead of creating a new collection.

The attendance schedule is modeled as a fixed weekly table with one row per day:
- Monday
- Tuesday
- Wednesday
- Thursday
- Friday
- Saturday
- Sunday

Each row contains:
- `day`
- `enabled`
- `checkInTime`

Only enabled rows with a valid `checkInTime` participate in punctuality evaluation.

Out of scope:
- check-out schedule rules
- multiple shifts per day
- holiday overrides
- per-user schedule exceptions
- automatic escalation when someone is still `Belum check-in` after the scheduled check-in time

## 3. UX Goals

The workspace settings page should make these actions easy:
- review the weekly workspace arrival schedule quickly
- activate or disable schedule evaluation per day
- set check-in time for each enabled day without leaving the page
- save the full weekly schedule in one action

The employee-facing and admin-facing attendance surfaces should reflect the schedule clearly:
- no check-in remains `Belum check-in`
- completed punctuality should be classified as `Tepat waktu` or `Terlambat`
- non-scheduled days should not be treated as late

Success criteria:
- admins can configure weekday-specific check-in times from workspace settings
- default workspaces receive sensible initial schedule values
- employee punctuality status no longer depends on a hard-coded global cutoff

## 4. Data Design

### 4.1 Settings Shape

Add a new field to the workspace settings document:

```ts
type AttendanceScheduleDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

type AttendanceScheduleRow = {
  day: AttendanceScheduleDay;
  enabled: boolean;
  checkInTime?: string; // "HH:mm"
};
```

Stored field:

```ts
attendanceSchedule: AttendanceScheduleRow[];
```

### 4.2 Validation Rules

Required invariants:
- exactly 7 rows
- each weekday appears exactly once
- `checkInTime` uses 24-hour `HH:mm` format
- enabled rows must include `checkInTime`
- disabled rows may omit `checkInTime`

### 4.3 Defaults and Backfill

When global settings are first ensured, the schedule should default to:
- Monday to Friday: enabled, `08:00`
- Saturday and Sunday: disabled

Existing workspaces that already have a settings document should receive the same default shape when settings are read or ensured, so the new feature does not depend on manual one-time migration work before the UI becomes usable.

## 5. UI Design

### 5.1 Surface

Add a new section to the workspace settings page under the existing workspace management area.

Recommended section title:
- `Jam Masuk Workspace`

### 5.2 Table Layout

The section should render a weekly table with these columns:
- `Hari`
- `Aktif`
- `Jam masuk`

Behavior:
- `Aktif` is a per-row toggle
- `Jam masuk` is edited with a COSS UI time picker
- when a row is disabled, the time picker is disabled
- changes remain local until the user clicks save

This should be a compact admin editing surface, not a modal workflow.

### 5.3 Save Model

The table should follow the current admin settings pattern:
- fetch current settings from the existing admin settings API
- edit locally in client state
- persist through explicit save

No autosave is recommended for the first iteration.

## 6. Behavior and Status Rules

### 6.1 Separate Two Status Concepts

The design must keep two concepts separate:

1. Attendance progress status
- `Belum check-in`
- `Belum check-out`
- `Lengkap`

2. Punctuality status
- `Tepat waktu`
- `Terlambat`
- `Tidak dinilai`

The current admin attendance workflow is centered on progress state. That should remain stable.

The new schedule primarily affects punctuality calculations used by employee KPI, employee history, and related discipline summaries.

### 6.2 Punctuality Rules

For a given attendance row:
- if `checkInAt` is missing, status remains `Belum check-in`
- if the schedule day is disabled, punctuality is `Tidak dinilai`
- if the schedule day is enabled and `checkInAt` local minutes are less than or equal to `checkInTime`, punctuality is `Tepat waktu`
- if the schedule day is enabled and `checkInAt` local minutes are greater than `checkInTime`, punctuality is `Terlambat`

### 6.3 Timezone Rules

Schedule comparison must use the workspace timezone already stored in settings.

Important consequence:
- day resolution must match the workspace timezone
- local check-in minutes must also be derived using the workspace timezone

Browser timezone must not become the source of truth for punctuality.

## 7. Technical Design

### 7.1 Backend Changes

Extend:
- `convex/schema.js`
- `convex/settings.js`
- workspace settings helper defaults in `convex/helpers.js` and any workspace bootstrap path that materializes settings
- `app/api/admin/settings/route.ts`

Behavioral backend work:
- add `attendanceSchedule` to validators and returned payloads
- accept and validate schedule updates in the existing admin settings mutation flow
- ensure missing schedule data is backfilled to the default weekly schedule

### 7.2 Punctuality Helper Changes

The current employee punctuality helper uses a fixed cutoff and should be replaced by schedule-aware logic.

Recommended helper split:
- one helper to map `dateKey` to weekday
- one helper to resolve the applicable schedule row for a given day
- one helper to convert `checkInTime` into minutes
- one helper to derive punctuality from `checkInAt`, timezone, and resolved schedule

This preserves testability and keeps schedule logic independent from page-level query code.

### 7.3 Consumer Updates

Schedule-aware punctuality should be consumed by:
- `convex/dashboardEmployee.js`
- `convex/employeeDashboardKpi.js`
- any employee attendance history or summary output currently relying on the fixed cutoff

Admin attendance progress views can stay mostly unchanged unless the UI already exposes punctuality labels there.

## 8. Reliability and Error Handling

Required safeguards:
- reject malformed schedule payloads
- reject enabled rows without a time value
- preserve existing settings fields when only the schedule is updated
- keep old workspaces readable even before their settings are explicitly re-saved

Important UI states:
- loading skeleton while settings load
- inline validation or page-level notice when schedule data is invalid
- success notice after save
- non-blocking failure notice if persistence fails

## 9. Testing Strategy

Recommended coverage:

Unit tests:
- weekday resolution from date keys
- parsing and validating `HH:mm`
- punctuality derivation using enabled day schedules
- non-scheduled day returns `Tidak dinilai`

Mutation and API tests:
- `superadmin` can update `attendanceSchedule`
- invalid schedule payload is rejected
- existing settings payloads still load after adding the new field

Behavior tests:
- on-time classification uses workspace timezone
- late classification changes according to the configured day schedule
- employee history and KPI no longer rely on the old fixed cutoff assumption

UI tests where practical:
- weekly table renders all days
- disabling a row disables its time input
- editing and saving sends the new schedule payload

## 10. Recommendation

The recommended implementation is:
- store weekly attendance schedule rows directly inside the existing workspace settings document
- present the schedule in a dedicated table section on workspace settings
- use the workspace timezone plus weekday-specific check-in times as the only source of punctuality evaluation
- keep progress status separate from punctuality status

This approach fits the current architecture, minimizes unnecessary data model sprawl, and directly supports the requested admin workflow without introducing shift-management complexity.
