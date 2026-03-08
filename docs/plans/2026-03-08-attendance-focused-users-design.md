# Attendance-Focused Users Page Design

Date: 2026-03-08
Project: Presence App
Scope: Refine `/dashboard/users` into an attendance-first daily operations workspace for `admin` and `superadmin`, while keeping `/dashboard/report` as the complete reporting surface.

## 1. Context and Problem

The current `/dashboard/report` page combines daily attendance review, scan-event inspection, device monitoring, and weekly report management in one place. That breadth is useful for reporting, but it creates distraction for admins who primarily need to monitor and correct daily attendance.

The current `/dashboard/users` page is still modeled as a user-management table. It shows account role/status data and is currently read-only, which does not match the daily operational workflow for attendance review.

The product goal is to keep `/dashboard/report` fully intact while redefining `/dashboard/users` as the focused daily workspace for:
- Reading daily attendance state
- Editing attendance lightly
- Browsing the employee roster as supporting context

## 2. Product Decisions

Validated decisions:
- `/dashboard/report` stays full-featured
- `/dashboard/users` becomes the focused daily operational page
- The new page is `attendance-first`
- Inline operations are limited to `light ops`

Light ops means:
- View attendance quickly
- Filter/search attendance quickly
- Edit attendance times with a short correction reason

Out of scope for `/dashboard/users`:
- Device monitoring
- Scan-event breakdown
- Weekly report history and export flows
- Full role management and full account administration

## 3. UX Goals

The refined `/dashboard/users` page should help admins answer these questions quickly:
- Who has not checked in yet today?
- Which attendance records are incomplete?
- Which records have already been edited?
- Which employee record needs a quick correction right now?

Success criteria:
- The primary table is attendance, not user accounts
- The main controls are attendance controls, not account controls
- Admin can complete common daily corrections without visiting `/dashboard/report`
- The page still feels lighter and more focused than `/dashboard/report`

## 4. High-Level IA

The page is split into four sections, ordered by operational priority.

### 4.1 Attendance Command Bar

This is the primary control surface and must remain visible near the top of the page.

Contents:
- Active date picker
- Search by employee name
- Attendance status filter
- Edited/original filter
- Refresh action

This replaces the current account-management filter model on `/dashboard/users`.

### 4.2 Daily Attendance KPI Strip

Operational KPI cards should summarize the selected day, not broad analytics.

Recommended metrics:
- Total employees tracked
- Checked in
- Checked out
- Not yet present
- Edited

These KPIs are intended for situational awareness, not long-form analysis.

### 4.3 Main Attendance Table

This is the core of the page.

Recommended columns:
- Employee name
- Attendance status
- Date
- Check-in time
- Check-out time
- Edited badge
- Actions

Recommended row actions:
- Inline edit check-in/check-out time
- Require a short correction reason
- Show visible confirmation before save

The table should support the daily review workflow first, not historical deep-dive behavior.

### 4.4 Secondary Employee Rail

Employee data remains available, but as supporting context rather than the main content.

Recommended content:
- Employee name
- Optional small role/status metadata if still useful
- Lightweight attendance indicator for the selected date

Recommended interaction:
- Clicking an employee filters or highlights that employee in the main attendance table

This rail preserves the “users” identity of the route without allowing employee management to dominate the page.

## 5. Interaction Model

### 5.1 Default State

The page should default to `today`.

The admin should land directly into the attendance table with no extra interaction required.

### 5.2 Filtering

The command bar should support:
- Search by employee name
- Attendance state filters such as `all`, `not checked-in`, `checked-in`, `incomplete`, `edited`
- Date selection

These filters should update the attendance table without introducing unrelated report-level controls.

### 5.3 Editing

Light attendance corrections should happen inline inside the main table.

Editing flow:
1. Admin clicks `Edit`
2. Row becomes editable for time inputs
3. Admin provides a correction reason
4. Admin confirms save
5. Row refreshes and remains marked as edited

The editing experience should remain compact. It should not turn into a large form or modal workflow unless implementation constraints force it.

### 5.4 Deliberate Exclusions

The page should not include:
- Device status tables
- Scan-event breakdown panels
- Weekly report generation controls
- Weekly report history tables
- Full role/status management controls

These remain on `/dashboard/report` or settings-oriented surfaces.

## 6. Technical Design

### 6.1 Route Strategy

The route remains:
- `/dashboard/users`

No routing changes are required for the first iteration.

### 6.2 Component Strategy

`components/dashboard/users-panel.tsx` should become a new attendance-workspace orchestrator rather than continuing as a pure user-management table.

Recommended component split:
- `UsersPanel`
- `AttendanceWorkspaceHeader`
- `AttendanceWorkspaceFilters`
- `AttendanceWorkspaceTable`
- `EmployeeQuickList`

This split keeps the route stable while changing the mental model of the page.

### 6.3 Data Sources

The new page should reuse existing backend contracts where practical:
- `/api/admin/attendance`
- `/api/admin/attendance/edit`
- `/api/admin/users`

Reuse should happen at the level of API contracts, types, and shared helpers, not by embedding slices of `ReportPanel`.

### 6.4 Boundary with Report Page

`ReportPanel` remains the broad reporting surface:
- reporting
- scan events
- device monitoring
- weekly exports

`UsersPanel` becomes the narrow operational surface:
- daily attendance review
- quick attendance corrections
- employee list as supporting context

This separation is intentional and should remain obvious in code and UI.

## 7. Reliability and Error Handling

The page should tolerate partial failures.

Required behavior:
- If employee rail fails, attendance table can still render
- If attendance edit fails, show a local or page-level notice without resetting the whole page
- If there is no attendance data for the selected date, show a precise empty state

Important UI states:
- `loading`: table skeletons or row placeholders, not a blocking full-page spinner
- `empty`: explain whether there is no data or no filtered result
- `partial degraded`: one section can retry independently without blocking the others

## 8. Testing Strategy

Recommended test coverage:

Unit tests:
- Attendance filter-to-query mapping
- Attendance status derivation (`not checked-in`, `incomplete`, `edited`)

Integration tests:
- Loading attendance data using selected filters
- Refreshing the table after inline attendance edit

Component tests:
- Command bar filter behavior
- Table edit state and confirmation flow
- Empty state and partial failure states

Smoke tests:
- `admin` and `superadmin` see the new attendance-focused `/dashboard/users`
- `/dashboard/report` remains intact as the complete reporting surface

## 9. Recommendation

The recommended approach is:
- Keep the same route
- Replace the current user-management mental model with a focused attendance workspace
- Preserve employee listing only as supporting context
- Keep full audit/reporting behavior on `/dashboard/report`

This gives admins a faster daily workflow without removing the existing reporting surface.
