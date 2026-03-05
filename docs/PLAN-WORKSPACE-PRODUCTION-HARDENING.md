# Plan: Production Hardening Multi-Workspace Isolation (Convex Best Practices)

## Summary
Kita akan mengubah arsitektur workspace menjadi strict tenant isolation:
- Endpoint admin/scan/device wajib `x-workspace-id` valid (tanpa fallback global).
- Semua query/mutation Convex yang mengakses data tenant wajib verifikasi membership/role workspace.
- Mode global unscoped untuk data operasional (`attendance`, `reports`, `users admin list/update`, `settings`) dinonaktifkan.
- Test suite diperbarui untuk mencerminkan policy baru dan harus hijau sebelum rilis.

Keputusan produk yang dikunci:
- `x-workspace-id` missing/invalid => `400` (`WORKSPACE_REQUIRED` / `WORKSPACE_INVALID`)
- Global mode lintas-workspace => disable

## Scope & Non-Scope
### In Scope
1. Hardening route handlers Next.js (`/api/admin/*`, `/api/scan`, `/api/device/*`) ke strict workspace context.
2. Hardening Convex function authorization agar tidak hanya role global.
3. Menutup jalur query unscoped tenant data.
4. Update tests unit/integration-level mocks dan negatif test lintas workspace.
5. Tambah guard observability minimum untuk pelanggaran workspace context.

### Out of Scope
1. Migrasi data historis lintas tenant.
2. Refactor UI besar selain handling error `WORKSPACE_REQUIRED`.
3. Perubahan auth provider (Clerk) atau model role dasar.

## API / Interface / Type Changes (Public Contract)
1. Semua endpoint tenant-sensitive:
- Sebelumnya: boleh tanpa header via `requireWorkspaceApiContextForMigration`.
- Baru: wajib `x-workspace-id`, gunakan strict resolver.
- Error contract:
  - missing header: `400 { code: "WORKSPACE_REQUIRED", message: ... }`
  - invalid header format: `400 { code: "WORKSPACE_INVALID", message: ... }`
  - bukan member workspace: `403 { code: "FORBIDDEN", message: ... }`

2. Convex function args untuk tenant data:
- Ubah `workspaceId: v.optional(v.id("workspaces"))` menjadi `workspaceId: v.id("workspaces")` pada fungsi tenant-sensitive:
  - attendance list/summary/edit/scan-events/report-related accessors
  - reports list/download/trigger
  - users admin listing/update yang berbasis membership workspace
  - settings workspace-level ops
- Jika ada fungsi yang harus tetap internal-global, tandai jelas sebagai internal-only dan tidak dipakai endpoint publik tenant.

3. Auth helper contract:
- `requireWorkspaceApiContextForMigration` tidak dipakai lagi di route tenant-sensitive.
- Gunakan `requireWorkspaceApiContext` + `requireWorkspaceRoleApiFromDb(roles, workspaceId)`.

## Detailed Implementation Steps
### 1) Strict Workspace Context di Next Route Layer
Target file group:
- `app/api/admin/**/route.ts`
- `app/api/scan/route.ts`
- `app/api/device/**/route.ts`

Changes:
1. Ganti semua pemakaian `requireWorkspaceApiContextForMigration(req)` -> `requireWorkspaceApiContext(req)`.
2. Hapus pattern konversi `workspaceId === "default-global" ? undefined : workspaceId`.
3. Selalu pass `workspaceId` hasil strict context ke:
   - `requireWorkspaceRoleApiFromDb(...)`
   - Convex query/mutation/action args.

Expected effect:
- Tidak ada jalur request tenant-sensitive tanpa scope workspace.

### 2) Convex Authorization Hardening (Best-Practice: “Functions are API”)
Target file group:
- `convex/attendance.js`
- `convex/reports.js`
- `convex/users.js`
- `convex/dashboard.js`
- `convex/settings.js`
- shared helpers di `convex/helpers.js`

Changes:
1. Untuk semua function tenant-sensitive:
   - role check global tidak cukup.
   - enforce `requireWorkspaceRole(ctx, workspaceId, allowedRoles)` atau kombinasi member+role sesuai endpoint.
2. Hilangkan branch unscoped (`workspaceId undefined`) dari query tenant data.
3. Pastikan semua query pakai `withIndex` yang sesuai workspace (sudah banyak tersedia di schema, tinggal enforce path).
4. Pertahankan `ConvexError` untuk user-facing errors (`FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`).

Expected effect:
- Pemanggilan langsung Convex dengan token valid tapi workspace asing tetap ditolak.

### 3) Contract Cleanup di Helpers
Target:
- `lib/auth.ts`
- `convex/helpers.js`

Changes:
1. `requireWorkspaceRoleApiFromDb` tidak lagi fallback ke `requireRoleApiFromDb` untuk alur tenant-sensitive.
2. Tambahkan helper eksplisit untuk membedakan:
   - tenant-sensitive path (strict workspace required)
   - genuinely global path (jika ada, explicit allowlist internal only).
3. Konsistenkan regex validasi workspace ID antara server & client helper.

### 4) UI/Client Safety Net
Target:
- Semua caller `workspaceFetch(...)` (sudah terpusat di panel/dashboard/onboarding/scan/device).

Changes:
1. Saat response `WORKSPACE_REQUIRED`, trigger UX recovery:
   - redirect ke picker/onboarding workspace atau show blocking prompt pilih workspace.
2. Pastikan state aktif workspace terset lewat `/api/workspaces/active` sebelum panel tenant load.

### 5) Testing & Quality Gate
Target tests:
- `tests/admin-attendance-route.test.ts` (currently failing)
- `tests/security-auth-rbac.test.ts`
- `tests/scan-guardrails.test.ts`
- tambah test baru untuk route admin/users/reports/settings dan scan/device.

Required scenarios:
1. Missing `x-workspace-id` pada endpoint tenant-sensitive => 400.
2. `x-workspace-id` invalid format => 400.
3. Header valid tapi user bukan member workspace => 403.
4. Header valid + member + role sesuai => 200.
5. Convex direct-call scenario:
   - role valid global tapi bukan member workspace => ditolak.
6. Regressions:
   - report download harus reject report dari workspace lain.
   - attendance/user list tidak mengembalikan row tenant lain.

Command acceptance:
- `npm test` harus full green.
- (Opsional tapi dianjurkan) `npm run lint` green.

### 6) Rollout & Monitoring
1. Rollout bertahap:
   - deploy perubahan strict header + convex guard.
   - monitor 24-48 jam.
2. Logging minimum (server):
   - count code `WORKSPACE_REQUIRED`, `WORKSPACE_INVALID`, `FORBIDDEN`.
3. Alert threshold:
   - lonjakan `WORKSPACE_REQUIRED` > baseline -> indikasi client belum kirim header.

## Convex Best Practices Applied
1. Authorization tidak hanya di edge route; juga di Convex function boundary.
2. Argument validator dibuat ketat (`workspaceId` required untuk tenant ops).
3. Return validators tetap eksplisit.
4. Query berbasis `withIndex` tenant-aware.
5. Error user-facing konsisten via `ConvexError` codes.

## Acceptance Criteria
1. Tidak ada endpoint tenant-sensitive yang bisa diakses tanpa `x-workspace-id`.
2. Tidak ada jalur unscoped tenant data untuk attendance/reports/users/settings.
3. Actor dengan role admin/superadmin global tapi tanpa membership workspace target tidak bisa baca/tulis data workspace tersebut.
4. Test suite hijau (`npm test`), termasuk test negatif lintas workspace.
5. Workspace isolation policy terdokumentasi (header required + membership required) untuk tim frontend/backend.

## Assumptions & Defaults
1. Semua operasi admin/report/attendance/settings/scan/device dianggap tenant-sensitive.
2. Tidak ada kebutuhan bisnis aktif untuk global cross-workspace view saat ini.
3. Header `x-workspace-id` tetap menjadi source-of-truth request scope.
4. Backward compatibility fallback `default-global` sengaja dihapus untuk keamanan production.
