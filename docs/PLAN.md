# Implementation Plan: Hardening Geofence / Location Lock

## Summary
Harden the current geofence flow as a fail-closed web-app guardrail: valid scans must come from a correctly configured geofence, with present and acceptable location accuracy, and invalid existing geofence configs must block scans until a superadmin fixes them.

This plan keeps the current architecture intact: Next.js route handlers stay thin, Convex mutations become the source of truth for business invariants, and the admin geofence screen becomes the single maintained surface for location-lock policy.

## Key Changes
### 1. Convex becomes the authoritative policy enforcer
- Add explicit geofence policy invariant checks in the settings mutation layer, not only type validators.
- `settings:update` must reject invalid combinations with `VALIDATION_ERROR`:
  - if `geofenceEnabled` is `true`, require both `geofenceLat` and `geofenceLng`
  - `geofenceLat` must be finite and between `-90` and `90`
  - `geofenceLng` must be finite and between `-180` and `180`
  - `geofenceRadiusMeters` must be finite and `>= 10`
  - `minLocationAccuracyMeters` must be finite and `> 0`
- Keep schema shape unchanged; no new table or migration is required.
- Keep whitelist semantics unchanged.

### 2. Scan enforcement becomes strict and predictable
- Update the scan enforcement path in [convex/attendance.js](/D:/Projects/Vibe%20Code/presence-app/convex/attendance.js) so geofence is enforced whenever `geofenceEnabled` is `true`, not only when center coordinates happen to exist.
- Add two explicit error codes to the scan contract:
  - `GEOFENCE_NOT_CONFIGURED`: geofence enabled but saved policy is incomplete/invalid
  - `GEOFENCE_ACCURACY_REQUIRED`: geofence enabled but client did not send `accuracyMeters`
- Preserve existing codes for:
  - `GEOFENCE_COORD_REQUIRED`
  - `GEOFENCE_ACCURACY_TOO_LOW`
  - `GEOFENCE_OUTSIDE_RADIUS`
- Change check order so token/device validity is resolved before location-only retries, then enforce geofence for valid scan attempts. Keep whitelist enforcement early.
- Existing workspaces with invalid saved geofence config will fail closed after deploy until fixed by superadmin.

### 3. Admin settings UX becomes the single source of truth
- Treat [components/dashboard/geofence-panel.tsx](/D:/Projects/Vibe%20Code/presence-app/components/dashboard/geofence-panel.tsx) as the only maintained UI for location-lock policy.
- Add `minLocationAccuracyMeters` to that page and rename the product copy to reflect what it really means: maximum allowed GPS uncertainty in meters.
- Add client-side prevalidation that mirrors the server rules:
  - enabling geofence without valid center/radius/accuracy shows inline errors
  - save is blocked until config is valid, or geofence is turned off
- On load, if the saved policy is already invalid while geofence is enabled, show a high-visibility warning banner explaining that scans will be blocked until fixed.
- Remove or stop maintaining the unused legacy settings editor in [app/settings/settings-panel.tsx](/D:/Projects/Vibe%20Code/presence-app/app/settings/settings-panel.tsx) so policy rules do not drift across duplicate forms.

### 4. Employee scan UX supports strict geofence without silent bypass
- Keep the current lazy location acquisition model, but retry only once per scan attempt.
- Retry geolocation when the server returns either `GEOFENCE_COORD_REQUIRED` or `GEOFENCE_ACCURACY_REQUIRED`.
- If location permission is denied, location is unavailable, or accuracy is still too low, show the blocking server error and do not proceed with attendance creation.
- Add clear copy for the new admin-misconfiguration case (`GEOFENCE_NOT_CONFIGURED`) telling the employee to contact admin.
- Do not add a fallback override flow in this hardening pass.

## Public API / Contract Changes
- `POST /api/scan` may now return:
  - `GEOFENCE_NOT_CONFIGURED`
  - `GEOFENCE_ACCURACY_REQUIRED`
- `PATCH /api/admin/settings` will now reject invalid geofence payloads that previously slipped through.
- The maintained geofence settings payload must include `minLocationAccuracyMeters` in the admin UI flow.
- No new endpoint is required.

## Test Plan
- Add pure validation tests for settings invariants:
  - geofence enabled without center coordinates
  - invalid latitude/longitude ranges
  - invalid radius
  - invalid accuracy threshold
  - disabled geofence with stored coordinates still allowed
- Add scan-policy tests for:
  - geofence enabled but not configured
  - missing coordinates
  - missing accuracy
  - low accuracy
  - outside radius
  - valid inside-radius scan
  - precedence: invalid/expired token returns token error before location retry logic
- Extend route tests for `/api/admin/settings` to cover rejected geofence payloads and accepted valid payloads with `minLocationAccuracyMeters`.
- Add a focused scan-panel client test with mocked `workspaceFetch` and `navigator.geolocation` to verify one retry only and fail-closed behavior.
- Re-run and keep passing:
  - `bun run test -- tests/security-auth-rbac.test.ts tests/scan-guardrails.test.ts tests/attendance-device-source.test.ts`
  - the new geofence-focused tests introduced by this change

## Assumptions
- Scope is hardening the current web flow, not redesigning into mobile attestation or trusted-device verification.
- Browser geolocation remains a user-provided signal; this plan makes the feature stricter and less fragile, but does not claim unspoofable anti-fraud guarantees.
- Invalid existing geofence configs should block scans until corrected, not auto-disable themselves.
- IP whitelist, QR token rotation, anti-replay, and device heartbeat behavior remain unchanged unless required by the scan check-order cleanup above.
