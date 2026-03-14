# Dashboard Mobile Dock Design

## Summary

Update the dashboard mobile bottom navigation so it matches the floating dock visual language already used on `/scan`, while preserving dashboard route differences by user role.

This change is limited to dashboard mobile navigation and its immediate supporting behavior. Desktop navigation stays functionally the same, but both desktop and mobile navigation should read from the same role-aware configuration source to avoid route drift.

## Goals

- Match the dashboard mobile dock visual style to the existing `/scan` dock.
- Keep dashboard navigation role-aware for `karyawan`, `admin`, and `superadmin`.
- Reduce duplicate mobile navigation affordances by consolidating account access into `More`.
- Keep the implementation maintainable by defining navigation in one shared source.

## Non-Goals

- Redesign the dashboard desktop sidebar.
- Redesign the dashboard header beyond removing redundant mobile account affordances.
- Change dashboard route ownership or permissions.
- Introduce new dashboard pages or new role capabilities.

## Current State

The dashboard mobile nav currently uses a full-width bottom bar with role-based items and a separate `Akun` button that opens an account panel. The `/scan` area already uses a floating pill dock with stronger visual polish and clearer active state behavior.

Relevant existing files:

- `components/dashboard/mobile-bottom-nav.tsx`
- `components/ui/scan-bottom-nav.tsx`
- `components/dashboard/sidebar.tsx`
- `components/dashboard/layout.tsx`

## Target Experience

### Visual Direction

Dashboard mobile navigation should adopt the `/scan` dock language:

- floating pill container
- centered layout
- blurred background
- soft border and shadow
- icon plus label per item
- animated active indicator

The result should feel like the dashboard and `/scan` belong to the same mobile navigation system.

### Information Architecture

The mobile dock always shows four visual slots:

1. three primary items
2. one `More` trigger

Primary items are role-specific. Secondary items move into `More`.

This four-slot rule applies to the currently supported dashboard roles in this repository. If a future role has no secondary items and no account access content for `More`, `More` may be omitted instead of rendering an empty fourth slot.

### Role Mapping

#### Karyawan

Primary:

- `Ringkasan` -> `/dashboard`
- `Absensi` -> `/dashboard/attendance`
- `Leaderboard` -> `/dashboard/leaderboard`

Secondary in `More`:

- none

Account section in `More`:

- `Akun`

#### Admin

Primary:

- `Ringkasan` -> `/dashboard`
- `Laporan` -> `/dashboard/report`
- `Karyawan` -> `/dashboard/users`

Secondary in `More`:

- none

Account section in `More`:

- `Akun`

#### Superadmin

Primary:

- `Ringkasan` -> `/dashboard`
- `Laporan` -> `/dashboard/report`
- `Karyawan` -> `/dashboard/users`

Secondary in `More`:

- `Workspace` -> `/settings/workspace`
- `Geofence` -> `/settings/geofence`

Account section in `More`:

- `Akun`

## Interaction Model

### Dock Behavior

- The dock remains mobile-only using the existing `md:hidden` boundary.
- Primary items navigate directly.
- `More` is a trigger, not a direct route.
- The dock remains mounted from the shared dashboard layout.

### More Behavior

- `More` opens a mini sheet from the bottom.
- The sheet should use the project-standard COSS UI sheet pattern rather than a custom overlay.
- The sheet contains route links from the role's secondary navigation plus a non-route account section with Clerk-managed account controls.

### Active State Rules

- A primary item is active when the current pathname matches its route using the same route-prefix logic already used in dashboard navigation.
- `More` is active when the current pathname belongs to any secondary route for the current role.
- `More` is also active while the `More` sheet is open, even if the current pathname still belongs to a primary route.
- When the user is on `Workspace` or `Geofence`, the dock should highlight `More` as the active destination.
- When the `More` sheet is open and the user is viewing the embedded `Akun` section, the `More` trigger should remain visually active during that interaction.
- While the `More` sheet is open, primary dock items should not remain visually selected.

### Account Access

- The existing dedicated mobile `Akun` bottom-nav button is removed.
- Account information and Clerk-managed account controls move into the `More` sheet.
- The mobile header `UserButton` should be hidden on mobile and remain available on desktop only.
- Mobile account access should exist in exactly one primary place: the `More` sheet.
- Mobile account capabilities currently exposed through Clerk should be preserved by providing a Clerk-managed account control inside the `More` sheet.
- If the chosen Clerk control already includes sign-out, the sheet should not render a separate duplicate logout action.
- The preferred interaction is a Clerk-backed account management trigger inside the sheet, such as a `UserButton`-driven profile action or equivalent Clerk-supported control, rather than a custom account settings implementation.
- Desktop account access remains unchanged.

### Search Query Preservation

- Existing dashboard behavior that carries the `q` query parameter between routes must continue to work.
- This applies to both primary dock links and secondary `More` links.

## Component Architecture

### Shared Navigation Source

Introduce a shared role-aware navigation configuration for dashboard navigation. This configuration should be the single source of truth for:

- desktop sidebar items
- mobile dock primary items
- mobile `More` secondary items

The shared configuration must support enough structure for both surfaces, including:

- desktop grouping
- optional desktop footer placement
- mobile `primary` items
- mobile `secondary` items
- mobile non-route sections such as `Akun`
- mobile account controls
- optional surface-specific labels where desktop and mobile wording intentionally differ

Each item should define at least:

- href
- label
- icon
- active matching behavior if needed

The config may expose this either as grouped sections with per-surface metadata or an equivalent structure, but the interface must be rich enough that desktop and mobile do not need to redefine routes in separate files.

This eliminates duplicate route definitions between mobile and desktop navigation.

One acceptable shape would separate:

- route items: navigable destinations with `href`
- sheet sections: non-route content blocks such as `Akun`
- account controls: Clerk-managed interactions such as opening account management

### Mobile Components

Recommended component boundaries:

- `DashboardMobileDock`
- `DashboardMobileMoreSheet`
- shared active-state helpers for dashboard navigation

Responsibilities:

- `DashboardMobileDock`: renders the floating pill dock and primary navigation
- `DashboardMobileMoreSheet`: renders the bottom sheet, secondary links, and account section
- active-state helper: determines whether a primary item or `More` is active

These units should stay small enough to test independently and understand without reading implementation internals.

The mobile dock and sheet should both respect safe-area spacing so they remain usable on devices with bottom insets. The floating dock should preserve bottom breathing room similar to `/scan`, and the bottom sheet should avoid overlapping the dock content in a way that causes clipped or obstructed actions.

### Desktop Sidebar Impact

The desktop sidebar should be migrated to read from the same shared navigation configuration, but its visual structure can remain unchanged.

Desktop wording should remain unchanged where it already differs intentionally. For example, the existing desktop superadmin label `Laporan & Device` may stay as-is, while mobile continues using the shorter `Laporan` label through surface-specific label support in the shared config.

This is a structural refactor in support of the mobile dock redesign, not a desktop UX redesign.

### UI Component Guidance

The repository guidance prefers COSS UI for UI component work.

For `More`:

- use COSS `Sheet`
- use bottom placement
- keep interactions touch-friendly and scroll-safe if content grows

`Menu` should not be used for this interaction because the approved behavior is a mobile mini sheet, not a compact dropdown.

## Edge Cases

- If a role has no secondary items in the future, keep `More` as long as it still contains the sole mobile account entry point.
- Only omit `More` when both secondary navigation and mobile account access content are absent.
- If navigation configuration is missing or malformed for a role, fall back to a minimal safe default: render only `Ringkasan` for mobile, render no `More`, and avoid rendering any secondary links.
- Deep-linking directly into secondary routes must still mark `More` as active on first render.
- Navigating from a secondary route back to a primary route must clear the `More` active state correctly.
- Sheet close state must not block navigation if a route transition occurs immediately after a tap.

## Testing

Add or update tests for the following:

- role-based navigation mapping
- active-state resolution for primary items
- active-state resolution for `More`
- preservation of the `q` query parameter across primary and secondary links
- `More` becomes active while its sheet is open even when opened from a primary route
- mobile rendering for each role:
  - `karyawan` shows `Ringkasan`, `Absensi`, `Leaderboard`, `More`
  - `admin` shows `Ringkasan`, `Laporan`, `Karyawan`, `More`
  - `superadmin` shows `Ringkasan`, `Laporan`, `Karyawan`, `More`
- `karyawan` `More` contains `Akun`
- `admin` `More` contains `Akun`
- `superadmin` `More` contains `Workspace`, `Geofence`, `Akun`
- legacy dedicated mobile account button is no longer rendered
- mobile header `UserButton` is hidden so `More` is the single account entry point on mobile
- mobile `More` preserves Clerk-managed account access without duplicating sign-out
- malformed role config falls back to `Ringkasan` only and renders no `More`
- roles with no secondary items still keep `More` when it remains the only mobile account entry point

## Implementation Notes

Recommended order:

1. extract shared dashboard navigation configuration
2. migrate sidebar to the shared configuration
3. rebuild dashboard mobile dock with `/scan` visual language
4. add `More` sheet and move account content into it
5. simplify mobile header account affordances
6. add and update tests

## Acceptance Criteria

- Dashboard mobile navigation visually aligns with the `/scan` floating dock pattern.
- Route mapping is correct for `karyawan`, `admin`, and `superadmin`.
- The dock shows exactly three primary items plus `More`.
- `More` opens a bottom mini sheet.
- `More` is highlighted when the current route belongs to secondary navigation.
- `Akun` is no longer a separate dedicated mobile nav tab.
- `Workspace` is available for `superadmin` inside `More`.
- Search query forwarding continues to work.
- Desktop and mobile dashboard navigation use a shared route configuration source.
- Opening `More` from a primary route visually activates the `More` trigger while the sheet is open.
- Safe fallback behavior exists for malformed role config and does not render broken secondary navigation.
