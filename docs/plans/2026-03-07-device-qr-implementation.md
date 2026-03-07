# Device QR Public Bootstrap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Mengganti flow `device-qr` berbasis role Clerk menjadi bootstrap publik berbasis registration code dan permanent device secret, tanpa mengganggu scan attendance yang sudah berjalan.

**Architecture:** Tambahkan dua entitas baru di Convex: `device_registration_codes` untuk tiket onboarding sementara dan `devices` untuk identitas perangkat permanen. Route handler publik di `app/api/device/**` memvalidasi access code dan device secret tanpa session Clerk, sementara area admin tetap memakai RBAC `superadmin` untuk generate code, rename, revoke, dan monitoring.

**Tech Stack:** Next.js 16 App Router, React 19 client components, Convex mutations/queries, Clerk untuk admin session, Vitest untuk route/lib tests, Bun scripts.

---

## Implementation Notes

- Referensi design source: `docs/plans/2026-03-06-device-qr-design.md`
- Referensi route handler behavior: `.next-docs/01-app/01-getting-started/15-route-handlers.mdx`
- Keep scope tight:
  - jangan redesign dashboard di luar modul device QR
  - jangan hapus role `device-qr` di phase awal
  - jangan ubah flow onboarding workspace umum
- Default technical decisions for implementation:
  - local secret disimpan di `localStorage`
  - device auth header memakai `x-device-key`
  - code plaintext ditampilkan sekali saat generate lalu hanya hash yang disimpan
  - revoked device dianggap invalid pada request berikutnya, bukan push invalidation

### Task 1: Add schema and shared device primitives

**Files:**
- Modify: `convex/schema.js`
- Create: `convex/devices.js`
- Create: `lib/device-auth.ts`
- Test: `tests/device-auth.test.ts`

**Step 1: Write the failing test**

- Add `tests/device-auth.test.ts` covering:
  - parsing `x-device-key`
  - empty / malformed key rejection
  - local storage payload serialization helpers if placed in `lib/device-auth.ts`

**Step 2: Run test to verify it fails**

Run: `bun run test -- tests/device-auth.test.ts`  
Expected: FAIL because `lib/device-auth.ts` does not exist yet.

**Step 3: Write minimal implementation**

- Extend `convex/schema.js` with:
  - `device_registration_codes`
  - `devices`
- Add indexes for:
  - registration code lookup by `workspaceId + codeHash`
  - registration code lookup by `workspaceId + expiresAt`
  - devices lookup by `workspaceId + status`
  - devices lookup by `workspaceId + deviceSecretHash`
- Add `lib/device-auth.ts` helpers for:
  - header extraction
  - safe payload typing for local device session
  - status/type constants reused by routes and UI
- Add `convex/devices.js` skeleton validators/types for later tasks.

**Step 4: Run test to verify it passes**

Run: `bun run test -- tests/device-auth.test.ts`  
Expected: PASS.

**Step 5: Commit checkpoint**

Commit: `feat(device-qr): add device auth primitives`

### Task 2: Implement Convex registration code lifecycle

**Files:**
- Modify: `convex/devices.js`
- Modify: `convex/helpers.js`
- Test: `tests/devices-registration-codes.test.ts`

**Step 1: Write the failing test**

- Add `tests/devices-registration-codes.test.ts` covering pure helper behavior for:
  - hashing code/secret deterministically
  - effective status derivation: `pending`, `claimed`, `expired`, `revoked`
  - claim guard rules rejecting expired/claimed/revoked codes

**Step 2: Run test to verify it fails**

Run: `bun run test -- tests/devices-registration-codes.test.ts`  
Expected: FAIL because registration code helpers/mutations are incomplete.

**Step 3: Write minimal implementation**

- In `convex/devices.js`, implement:
  - `createRegistrationCode` mutation (`superadmin` only)
  - `listRegistrationCodes` query (`superadmin` only)
  - internal helpers for hashing and derived status
  - `validateRegistrationCodePreview` public/internal query used before claim
  - `claimRegistrationCode` mutation performing atomic:
    - validate code
    - insert device
    - hash device secret
    - mark code claimed
    - return plaintext secret once
- Reuse existing `audit_logs` table for generate/claim/revoke/rename events.

**Step 4: Run test to verify it passes**

Run: `bun run test -- tests/devices-registration-codes.test.ts`  
Expected: PASS.

**Step 5: Commit checkpoint**

Commit: `feat(device-qr): add registration code lifecycle`

### Task 3: Add device-authenticated route helpers and public bootstrap endpoints

**Files:**
- Modify: `lib/auth.ts`
- Modify: `lib/convex-http.ts`
- Create: `app/api/device/bootstrap/validate-code/route.ts`
- Create: `app/api/device/bootstrap/claim/route.ts`
- Create: `app/api/device/auth/route.ts`
- Test: `tests/device-bootstrap-routes.test.ts`

**Step 1: Write the failing test**

- Add `tests/device-bootstrap-routes.test.ts` covering:
  - `validate-code` rejects missing workspace header
  - `validate-code` returns generic invalid response for bad code
  - `claim` returns secret payload on success
  - `auth` accepts valid `x-device-key`
  - `auth` rejects revoked/unknown device secret

**Step 2: Run test to verify it fails**

Run: `bun run test -- tests/device-bootstrap-routes.test.ts`  
Expected: FAIL because routes/helpers do not exist.

**Step 3: Write minimal implementation**

- In `lib/auth.ts`, keep Clerk-based helpers intact and add separate device helpers:
  - `requireWorkspaceApiContext`
  - `getDeviceKeyFromRequest`
  - `requireWorkspaceDeviceApi`
- Ensure public bootstrap endpoints do not call Clerk auth.
- In `app/api/device/bootstrap/validate-code/route.ts`, call preview validation.
- In `app/api/device/bootstrap/claim/route.ts`, accept `{ code, label }`.
- In `app/api/device/auth/route.ts`, verify stored secret hash and return device metadata for active session restore.

**Step 4: Run test to verify it passes**

Run: `bun run test -- tests/device-bootstrap-routes.test.ts`  
Expected: PASS.

**Step 5: Commit checkpoint**

Commit: `feat(device-qr): add bootstrap and device auth routes`

### Task 4: Replace `/device-qr` page with public bootstrap state machine

**Files:**
- Modify: `app/device-qr/page.tsx`
- Modify: `app/device-qr/device-qr-panel.tsx`
- Create: `components/device-qr/device-bootstrap-form.tsx`
- Create: `components/device-qr/device-active-panel.tsx`
- Test: `tests/device-qr-panel-state.test.tsx`

**Step 1: Write the failing test**

- Add `tests/device-qr-panel-state.test.tsx` for client state transitions:
  - no local secret -> `enter-code`
  - valid code -> `name-device`
  - successful claim -> persist local session and enter `active-device`
  - invalid/revoked auth restore -> clear local session and return `enter-code`

**Step 2: Run test to verify it fails**

Run: `bun run test -- tests/device-qr-panel-state.test.tsx`  
Expected: FAIL because the panel still assumes authenticated Clerk device user.

**Step 3: Write minimal implementation**

- Remove `requireWorkspaceRolePageFromDb(['device-qr'])` from `app/device-qr/page.tsx`.
- Keep `requireWorkspaceOnboardingPage()` only if public workspace selection must remain cookie-bound; otherwise move workspace resolution fully to header/client layer during implementation.
- Refactor `device-qr-panel.tsx` into explicit states:
  - `enter-code`
  - `name-device`
  - `active-device`
- Persist `{ deviceId, label, secret, claimedAt }` in `localStorage`.
- On mount:
  - restore local session
  - call `/api/device/auth`
  - clear stale session on failure

**Step 4: Run test to verify it passes**

Run: `bun run test -- tests/device-qr-panel-state.test.tsx`  
Expected: PASS.

**Step 5: Commit checkpoint**

Commit: `feat(device-qr): add public bootstrap ui`

### Task 5: Move QR token issuance and heartbeat from `deviceUserId` to `deviceId`

**Files:**
- Modify: `convex/qrTokens.js`
- Modify: `convex/deviceHeartbeat.js`
- Modify: `convex/schema.js`
- Modify: `app/api/device/qr-token/route.ts`
- Modify: `app/api/device/ping/route.ts`
- Test: `tests/device-routes-auth.test.ts`
- Test: `tests/device-heartbeat-policy.test.ts`

**Step 1: Write the failing test**

- Add `tests/device-routes-auth.test.ts` covering:
  - `/api/device/qr-token` requires valid `x-device-key`
  - `/api/device/ping` requires valid `x-device-key`
  - revoked device gets rejection on next request
  - route forwards `ipAddress` and `userAgent`

**Step 2: Run test to verify it fails**

Run: `bun run test -- tests/device-routes-auth.test.ts tests/device-heartbeat-policy.test.ts`  
Expected: FAIL because routes still require Clerk role `device-qr`.

**Step 3: Write minimal implementation**

- Change schema references:
  - `qr_tokens.deviceUserId` -> `deviceId`
  - `device_heartbeats.deviceUserId` -> `deviceId`
- Update `convex/qrTokens.js`:
  - issue tokens for authenticated device
  - validate/consume returns `deviceId`
- Update `convex/deviceHeartbeat.js`:
  - ping keyed by `deviceId`
  - list status returns device label/status instead of user info
- Update both route handlers to use device auth helper, not Clerk auth.

**Step 4: Run test to verify it passes**

Run: `bun run test -- tests/device-routes-auth.test.ts tests/device-heartbeat-policy.test.ts`  
Expected: PASS.

**Step 5: Commit checkpoint**

Commit: `refactor(device-qr): switch runtime auth to device ids`

### Task 6: Update scan ingestion and attendance metadata to permanent devices

**Files:**
- Modify: `convex/attendance.js`
- Modify: `convex/schema.js`
- Modify: `app/api/scan/route.ts`
- Modify: `tests/scan-guardrails.test.ts`
- Create: `tests/attendance-device-source.test.ts`

**Step 1: Write the failing test**

- Extend `tests/scan-guardrails.test.ts` and add `tests/attendance-device-source.test.ts` to cover:
  - scan consumes token linked to `deviceId`
  - attendance metadata writes `sourceDeviceId` from `devices`
  - stale/revoked device is rejected when heartbeat enforcement is on

**Step 2: Run test to verify it fails**

Run: `bun run test -- tests/scan-guardrails.test.ts tests/attendance-device-source.test.ts`  
Expected: FAIL because Convex attendance code still expects `deviceUserId`.

**Step 3: Write minimal implementation**

- Change attendance + scan event fields from `deviceUserId` semantics to `deviceId`.
- Ensure scan result, audit info, and heartbeat checks refer to registered devices.
- Preserve employee auth on `app/api/scan/route.ts`; only the consumed QR token source changes.

**Step 4: Run test to verify it passes**

Run: `bun run test -- tests/scan-guardrails.test.ts tests/attendance-device-source.test.ts`  
Expected: PASS.

**Step 5: Commit checkpoint**

Commit: `refactor(attendance): track permanent device sources`

### Task 7: Build superadmin device management APIs

**Files:**
- Modify: `convex/devices.js`
- Create: `app/api/admin/device/registration-codes/route.ts`
- Create: `app/api/admin/device/devices/route.ts`
- Create: `app/api/admin/device/devices/[deviceId]/route.ts`
- Test: `tests/admin-device-management-routes.test.ts`

**Step 1: Write the failing test**

- Add `tests/admin-device-management-routes.test.ts` covering:
  - only `superadmin` can generate registration code
  - admin read/write attempts are forbidden
  - rename works for active device
  - revoke changes device status and blocks future auth

**Step 2: Run test to verify it fails**

Run: `bun run test -- tests/admin-device-management-routes.test.ts`  
Expected: FAIL because admin device management routes do not exist.

**Step 3: Write minimal implementation**

- Route design:
  - `GET /api/admin/device/registration-codes`
  - `POST /api/admin/device/registration-codes`
  - `GET /api/admin/device/devices`
  - `PATCH /api/admin/device/devices/[deviceId]` for rename/revoke
- Reuse `requireWorkspaceRoleApiFromDb(["superadmin"], workspaceId)`.
- Return derived status fields needed by dashboard:
  - `pending/claimed/expired/revoked`
  - `online/offline`
  - `lastSeenAt`, `claimedAt`, `claimedFromCodeId`

**Step 4: Run test to verify it passes**

Run: `bun run test -- tests/admin-device-management-routes.test.ts`  
Expected: PASS.

**Step 5: Commit checkpoint**

Commit: `feat(device-qr): add superadmin device management apis`

### Task 8: Add superadmin dashboard UI for devices and registration codes

**Files:**
- Modify: `components/dashboard/report-panel.tsx`
- Modify: `app/api/admin/device/heartbeat/route.ts`
- Modify: `components/dashboard/sidebar.tsx`
- Create: `components/dashboard/device-management-panel.tsx`
- Test: `tests/device-management-panel.test.tsx`

**Step 1: Write the failing test**

- Add `tests/device-management-panel.test.tsx` covering:
  - code list rendering
  - device list rendering
  - rename submit state
  - revoke confirmation flow
  - visibility only for `superadmin`

**Step 2: Run test to verify it fails**

Run: `bun run test -- tests/device-management-panel.test.tsx`  
Expected: FAIL because management UI does not exist yet.

**Step 3: Write minimal implementation**

- Replace “heartbeat akun device-qr” language with permanent device terminology.
- Add dashboard section for:
  - device list
  - registration code list
  - generate code action
  - rename/revoke actions
- Keep UI aligned with existing dashboard patterns and avoid wider nav changes unless necessary.

**Step 4: Run test to verify it passes**

Run: `bun run test -- tests/device-management-panel.test.tsx`  
Expected: PASS.

**Step 5: Commit checkpoint**

Commit: `feat(device-qr): add superadmin management ui`

### Task 9: Migration safety, cleanup, and final verification

**Files:**
- Modify: `convex/crons.js`
- Modify: `convex/devices.js`
- Modify: `docs/plans/2026-03-06-device-qr-design.md`
- Create: `tests/device-registration-cleanup.test.ts`

**Step 1: Write the failing test**

- Add `tests/device-registration-cleanup.test.ts` covering:
  - expired code cleanup selection
  - revoked device remains blocked
  - optional derived status logic for expired codes

**Step 2: Run test to verify it fails**

Run: `bun run test -- tests/device-registration-cleanup.test.ts`  
Expected: FAIL because cleanup path is incomplete.

**Step 3: Write minimal implementation**

- Add cleanup job for expired registration codes if low-risk.
- Update docs with:
  - chosen header name
  - local secret persistence decision
  - migration order and rollback notes
- Do not remove legacy `device-qr` role yet; only isolate it from active runtime path.

**Step 4: Run focused verification**

Run: `bun run test -- tests/device-auth.test.ts tests/devices-registration-codes.test.ts tests/device-bootstrap-routes.test.ts tests/device-routes-auth.test.ts tests/scan-guardrails.test.ts tests/admin-device-management-routes.test.ts tests/device-registration-cleanup.test.ts`  
Expected: PASS.

**Step 5: Run broad verification**

Run: `bun run test`  
Expected: PASS all existing and new tests.

**Step 6: Run lint**

Run: `bun run lint`  
Expected: PASS with no new lint errors.

**Step 7: Commit checkpoint**

Commit: `feat(device-qr): complete public bootstrap migration`

## Suggested Execution Order

1. Task 1  
2. Task 2  
3. Task 3  
4. Task 4  
5. Task 5  
6. Task 6  
7. Task 7  
8. Task 8  
9. Task 9

## Risks to Watch

- `app/device-qr/page.tsx` currently hard-requires Clerk workspace access, which conflicts with the new public bootstrap model.
- `lib/auth.ts` currently assumes all protected API access is Clerk-backed; keep device auth isolated to avoid breaking admin/karyawan routes.
- `convex/schema.js` currently stores `deviceUserId` in multiple places; partial migration can break scan replay protection if not updated consistently.
- `components/dashboard/report-panel.tsx` still frames monitoring around “akun device-qr”; update labels and payload shapes together.
- Workspace resolution for a public route must remain explicit via `x-workspace-id` and not rely on user session.

## Done Criteria

- `/device-qr` works without Clerk sign-in.
- Claim flow is `enter-code -> name-device -> active-device`.
- Active device survives reload via local secret and reauth.
- Revoked device drops back to code entry on next runtime request.
- QR token issuance, heartbeat, and attendance metadata all use `deviceId`.
- Only `superadmin` can generate codes, rename devices, and revoke devices.
- Focused tests, full test suite, and lint all pass.
