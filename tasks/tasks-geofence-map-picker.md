## Relevant Files

- `components/dashboard/geofence-panel.tsx` - Existing admin geofence form that should remain the main owner of local form state and save flow.
- `components/dashboard/geofence-map-picker.tsx` - Proposed client-only map surface wrapper for map rendering, click selection, and draggable marker behavior.
- `components/dashboard/geofence-search-box.tsx` - Proposed search form component for explicit submit-based geocoder queries.
- `components/dashboard/geofence-search-results.tsx` - Proposed result list component for candidate selection and empty/error states.
- `app/settings/geofence/page.tsx` - Geofence settings route entry point that should keep rendering the existing panel.
- `app/api/admin/settings/route.ts` - Existing GET/PATCH boundary whose payload shape must stay unchanged.
- `convex/helpers.js` - Existing backend geofence validation helpers that should remain the enforcement source of truth.
- `tests/geofence-settings.test.ts` - Current regression coverage for geofence settings validation and save behavior.
- `tests/geofence-panel.test.tsx` - Proposed focused component tests for hybrid picker form behavior and local state transitions.
- `tests/geofence-map-picker.test.tsx` - Proposed focused interaction tests for map click, marker drag, and search-result selection flows.
- `lib/geofence-geocoder.ts` - Proposed helper for explicit Nominatim fetch/mapping logic and search error handling.
- `lib/geofence-map.ts` - Proposed helper for map defaults, selected-point mapping, and viewport utilities.
- `package.json` - Dependency surface for adding any required `mapcn` / MapLibre packages used by the picker.

### Notes

- Keep the saved settings contract unchanged: `geofenceLat`, `geofenceLng`, `geofenceRadiusMeters`, and `minLocationAccuracyMeters`.
- Use `bun run lint` and `bun run test` for final verification.
- Prefer dynamic or lazy loading for the map picker so the route only pays the cost when the geofence panel is used.

## Instructions for Completing Tasks

**IMPORTANT:** As you complete each task, check it off by changing `- [ ]` to `- [x]`. Update after completing each sub-task.

## Tasks

- [x] 0.0 Create feature branch
- [x] 0.1 Create and checkout a new branch (`git checkout -b codex/geofence-map-picker`)
- [x] 1.0 Audit the current geofence settings flow and define the integration boundary for the hybrid picker
  - [x] 1.1 Review `components/dashboard/geofence-panel.tsx` and identify which state stays in the panel versus which logic should move into helper/components.
  - [x] 1.2 Confirm `app/api/admin/settings/route.ts` and `convex/helpers.js` can stay unchanged because the saved payload shape and validation rules are not changing.
  - [x] 1.3 Inspect `package.json` and decide the exact map dependencies, styles, and dynamic-loading approach needed for a `mapcn` + MapLibre implementation.
  - [x] 1.4 Define the local source of truth for the selected point, readonly coordinate display, and save payload projection back into `geofenceLat` / `geofenceLng`.
- [x] 2.0 Add explicit geocoding search state and result-selection handling for the geofence form
  - [x] 2.1 Create `lib/geofence-geocoder.ts` to fetch Nominatim only on explicit submit and map raw results into a small UI-safe result type.
  - [x] 2.2 Add local panel state for `searchQuery`, `searchStatus`, `searchError`, `searchResults`, and `selectedPoint`.
  - [x] 2.3 Create `components/dashboard/geofence-search-box.tsx` for the query input and submit button without per-keystroke requests.
  - [x] 2.4 Create `components/dashboard/geofence-search-results.tsx` to render 3-5 result candidates, no-result state, and recoverable search errors.
  - [x] 2.5 Wire result selection so picking a candidate updates `selectedPoint`, readonly coordinates, and the requested map viewport without auto-saving.
- [x] 3.0 Implement a client-only map picker with click-to-set and draggable-marker behavior
  - [x] 3.1 Add the required map dependencies in `package.json` and any associated style imports needed by the chosen `mapcn` setup.
  - [x] 3.2 Create `lib/geofence-map.ts` for default center/zoom rules, selected-point guards, and viewport helpers.
  - [x] 3.3 Create `components/dashboard/geofence-map-picker.tsx` as a client-only component that renders the map, current marker, and fallback notice when the map fails to load.
  - [x] 3.4 Implement map click handling so clicking the map replaces the current selected point immediately in local form state.
  - [x] 3.5 Implement draggable-marker support so drag end updates the selected point and displayed coordinates precisely.
  - [x] 3.6 Ensure existing saved coordinates initialize the marker and viewport, with a sensible Indonesia-oriented fallback when no coordinates exist.
- [x] 4.0 Refactor the geofence panel UI into a desktop-first hybrid search-and-map layout
  - [x] 4.1 Replace manual editable latitude/longitude inputs in `components/dashboard/geofence-panel.tsx` with readonly coordinate display fed by `selectedPoint`.
  - [x] 4.2 Keep timezone, geofence radius, GPS accuracy, and the existing save button workflow in the same panel.
  - [x] 4.3 Arrange the geofence block into a two-column desktop layout with controls on the left and the map on the right, while preserving a stacked narrow-screen layout.
  - [x] 4.4 Lazy-load the map picker inside the panel so the route does not eagerly load the full map surface on initial render.
  - [x] 4.5 Preserve the existing notice and warning patterns so validation and save feedback remain consistent with the current settings screen.
- [x] 5.0 Preserve the existing save contract and fail-closed validation behavior without backend model changes
  - [x] 5.1 Initialize `selectedPoint` from loaded settings and project it back into `data.geofenceLat` / `data.geofenceLng` only within local form state.
  - [x] 5.2 Keep `geofenceRadiusMeters` and `minLocationAccuracyMeters` as editable numeric inputs and leave the PATCH payload shape unchanged.
  - [x] 5.3 Ensure enabling geofence without a valid selected point still triggers blocking validation before save.
  - [x] 5.4 Verify that search result selection, map clicks, and marker drags only update local state until `Simpan Perubahan` is submitted.
  - [x] 5.5 Avoid backend or route changes unless implementation details uncover a concrete incompatibility that cannot be resolved in the client.
- [x] 6.0 Add focused tests for picker interactions, local error states, and geofence validation regressions
  - [x] 6.1 Add `tests/geofence-panel.test.tsx` to cover initializing from saved settings, readonly coordinate updates, and save blocking when geofence is enabled without a valid point.
  - [x] 6.2 Add `tests/geofence-map-picker.test.tsx` to cover search-result selection, map click updates, and draggable-marker updates using mocked map interactions.
  - [x] 6.3 Add helper tests for `lib/geofence-geocoder.ts` and `lib/geofence-map.ts` covering result mapping, fallback defaults, and selection transitions.
  - [x] 6.4 Keep `tests/geofence-settings.test.ts` passing unchanged to prove backend validation behavior remains intact.
  - [x] 6.5 Run `bun run lint` and `bun run test`, then capture any follow-up fixes required by the new picker code or tests.
