# Geofence Map Picker Design

## Summary

Replace manual latitude/longitude entry in the admin geofence settings screen with a desktop-first hybrid picker:

- submit-based place search
- clickable map
- draggable marker for final adjustment

The saved geofence model does not change. Backend settings continue storing `geofenceLat`, `geofenceLng`, `geofenceRadiusMeters`, and `minLocationAccuracyMeters`, so the current fail-closed enforcement remains intact.

This feature is feasible with `mapcn` because it is built on MapLibre and supports custom map styles, markers, draggable markers, and direct access to the map instance for click handling.

## Goals

- Make geofence center selection easier than manual coordinate typing.
- Preserve the current geofence backend model and validation rules.
- Keep the admin UX precise enough for office entrance placement.
- Support an OpenStreetMap-based visual style.
- Keep the screen usable on desktop without forcing a mobile-first interaction model.

## Non-Goals

- Changing how scan-time geofence enforcement works.
- Changing the geofence payload shape in Convex or route handlers.
- Adding interactive radius drawing on the map.
- Introducing live autocomplete against public `Nominatim`.
- Redesigning the whole settings area outside the geofence block.

## Current State

The current maintained admin surface is [components/dashboard/geofence-panel.tsx](/D:/Projects/vibecode/presence-app/components/dashboard/geofence-panel.tsx).

Today the geofence center is configured with numeric `Latitude` and `Longitude` inputs only. Validation is already enforced in both UI and backend:

- route layer: [app/api/admin/settings/route.ts](/D:/Projects/vibecode/presence-app/app/api/admin/settings/route.ts)
- Convex helpers: [convex/helpers.js](/D:/Projects/vibecode/presence-app/convex/helpers.js)
- focused tests: [tests/geofence-settings.test.ts](/D:/Projects/vibecode/presence-app/tests/geofence-settings.test.ts)

This means the product problem is UX, not data modeling.

## Recommendation

Implement a hybrid picker in the existing geofence panel:

1. search for a place or address
2. choose one result
3. auto-center the map and place the marker
4. allow click-to-set on the map
5. allow drag-to-adjust on the marker
6. keep radius and GPS accuracy as numeric inputs

This gives fast initial placement and precise final tuning without changing the policy model.

## Approach Comparison

### Recommended: Hybrid Picker

- Search narrows the area quickly.
- Map click supports manual override.
- Marker drag supports precise final correction.
- Works well for desktop admins who know the office area but still need visual placement.

### Alternative: Map-Only

- Lowest implementation complexity.
- Weak for admins who know the location name but not the exact map area.
- Slower for first placement.

### Alternative: Search-Heavy

- Fast when search results are accurate.
- Too dependent on geocoder precision.
- Weak for final point correction around office entrances or building offsets.

## External Services and Constraints

### Map Rendering

Use `mapcn` with a MapLibre-compatible OpenStreetMap-based style JSON.

Examples of acceptable style direction:

- OpenStreetMap-derived vector style
- CARTO or equivalent OSM-based MapLibre style JSON

Do not depend on raw raster tile assumptions if the chosen `mapcn` setup expects MapLibre style specifications.

### Geocoding

Use public `Nominatim` for MVP geocoding because this screen is low-volume and admin-only.

Important constraint:

- do not implement per-keystroke autocomplete against public `Nominatim`

The allowed interaction should be:

- user enters query
- user submits search explicitly
- app fetches result candidates once per submit

This keeps the design aligned with the official public `Nominatim` usage policy and avoids unnecessary request volume.

## Target Experience

### Desktop Layout

Within the existing geofence settings screen, split the geofence block into two columns on desktop:

- left column: search, search results, selected coordinates, radius, GPS accuracy
- right column: interactive map with marker

Suggested behavior:

- search input with `Cari` button
- result list showing 3-5 candidates
- selecting a candidate updates marker and map center
- current coordinates are displayed as readonly values
- radius and accuracy remain editable numeric inputs

### Mobile / Narrow Layout

The same content can stack vertically:

- search and controls first
- map below

Desktop remains the primary optimization target.

## Interaction Model

### Initial Load

- Load existing settings through the current `GET /api/admin/settings` flow.
- If saved `geofenceLat` and `geofenceLng` exist, render the marker at that point.
- Center the map on the saved marker when possible.
- If no saved coordinates exist, use a sensible default center for the current timezone/region or a neutral Indonesia-oriented default view.

### Search Flow

- Admin enters a query and submits.
- The client requests public `Nominatim`.
- The UI renders a result list with human-readable labels.
- Selecting one result:
  - updates the selected marker point
  - updates readonly coordinate display
  - centers the map to that location
  - sets an appropriate zoom level for refinement

### Map Click Flow

- Clicking the map sets the geofence center to the clicked coordinates.
- If a search result had been selected earlier, the clicked point becomes the new source of truth.
- Readonly coordinate display updates immediately.

### Marker Drag Flow

- The marker is draggable.
- Drag end updates the selected coordinates.
- Readonly coordinate display updates immediately.

### Save Flow

- The map/search interactions only change local form state.
- Nothing persists until the admin clicks `Simpan Perubahan`.
- The existing PATCH flow remains the persistence boundary.

## Component Architecture

Keep the existing screen entry point:

- [app/settings/geofence/page.tsx](/D:/Projects/vibecode/presence-app/app/settings/geofence/page.tsx)

Recommended component boundaries:

- `GeofencePanel`
- `GeofenceMapPicker`
- `GeofenceSearchBox`
- `GeofenceSearchResults`
- small local helper utilities for geocoder mapping and map state transitions

Responsibilities:

- `GeofencePanel`: owns the form and save workflow
- `GeofenceMapPicker`: renders `mapcn`, marker, click handling, drag handling
- `GeofenceSearchBox`: owns query input and submit action
- `GeofenceSearchResults`: shows result candidates and selection actions

The selected point should remain in one local source of truth within the panel, then be projected into the payload sent to the existing settings API.

## State and Data Flow

Recommended local state:

- `searchQuery`
- `searchStatus`
- `searchError`
- `searchResults`
- `selectedPoint`
- `mapViewport`
- existing settings form state

Data flow:

1. load saved settings
2. initialize `selectedPoint` from saved geofence coordinates if present
3. search submission fetches geocoder results
4. result selection, map click, or marker drag all update `selectedPoint`
5. save projects `selectedPoint` into `geofenceLat` and `geofenceLng`
6. backend validation and persistence remain unchanged

## Error Handling

- If geocoder search fails, show a local search error and keep the rest of the form usable.
- If geocoder returns no results, show an empty state and leave the existing point untouched.
- If the map style or map network resources fail to load, keep the rest of the form usable and show a notice that map selection is temporarily unavailable.
- If the admin enables geofence without a valid selected point, preserve the current blocking validation behavior.
- Search result selection must never auto-save the configuration.

## Performance and Integration Notes

- Treat the map block as client-only.
- Prefer lazy or dynamic loading for the map surface so the settings route does not become heavier than necessary.
- Keep geocoder fetches explicit and low frequency.
- Avoid introducing a server proxy for `Nominatim` in the MVP unless CORS, abuse control, or audit requirements prove it necessary.

## Testing

Add focused coverage for:

- selecting a search result updates the selected point and displayed coordinates
- clicking the map updates the selected point
- dragging the marker updates the selected point
- search failure shows a local error without breaking the rest of the form
- save still blocks invalid enabled geofence state
- existing geofence backend validation tests continue to pass unchanged

Testing scope should prioritize:

- focused component tests around the geofence panel behavior
- small helper tests for result-to-point mapping and selection transitions

The backend geofence policy tests should remain the source of truth for enforcement behavior.

## Acceptance Criteria

- Admin can set geofence center by clicking the map.
- Admin can search a place/address and choose a result to place the marker.
- Admin can drag the marker to refine the final point.
- Admin can still edit radius and GPS accuracy numerically.
- Saved payload shape for settings remains unchanged.
- Existing backend validation and fail-closed geofence enforcement remain intact.
- Public `Nominatim` is used in a submit-based search flow, not per-keystroke autocomplete.
- The desktop layout is clearly more usable than manual coordinate entry.

## Feasibility Verdict

This feature is feasible and recommended.

The safest implementation is:

- `mapcn` for the map UI
- OpenStreetMap-based MapLibre style JSON for rendering
- public `Nominatim` for submit-based search
- draggable marker plus click-to-set behavior
- existing backend payload and validation preserved as-is

## References

- `mapcn` documentation:
  - [Basic Map](https://www.mapcn.dev/docs/basic-map)
  - [Markers](https://www.mapcn.dev/docs/markers)
  - [Advanced Usage](https://www.mapcn.dev/docs/advanced-usage)
  - [API Reference](https://www.mapcn.dev/docs/api-reference)
- OpenStreetMap Foundation public `Nominatim` usage policy:
  - [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/)
