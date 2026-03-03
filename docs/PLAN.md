# Implementasi Single Source Role di Convex

## Ringkasan
Tujuan refactor adalah menjadikan **`users.role` di Convex** sebagai satu-satunya source of truth untuk authorization.  
Keputusan yang dipakai:
- `sync-user` **tidak pernah overwrite role**.
- Middleware hanya cek **authenticated**.
- Role gate dilakukan di **Server Page + API route**, dengan lookup role dari Convex.
- User legacy tanpa row Convex akan **auto-create default `karyawan`** saat sync.

---

## Perubahan Arsitektur

1. **AuthN vs AuthZ dipisah tegas**
- Middleware: hanya autentikasi Clerk (login/no-login).
- AuthZ role: hanya dari Convex DB (`users.role`) di server layer.

2. **Source of truth role**
- Role hanya bisa berubah lewat mutation Convex admin khusus (`users:updateRole` / endpoint manajemen role).
- `publicMetadata.role` Clerk tidak dipakai untuk keputusan akses.

3. **Sinkronisasi user**
- `sync-user` hanya sinkron `clerkUserId`, `name`, `email`, `isActive`, timestamp.
- Pada user baru, insert dengan role default `karyawan`.

---

## Perubahan API/Interface Publik

1. **`lib/auth.ts`**
- `getCurrentSession()` diubah agar mengambil role dari Convex, bukan `sessionClaims.metadata`.
- Tambah helper baru:
  - `getCurrentDbUserSession()` → `{ userId, dbUser, role }` dari Convex.
  - `requireRolePageFromDb(roles)` dan `requireRoleApiFromDb(roles)`.

2. **`app/api/sync-user/route.ts`**
- Hapus pembacaan `user.publicMetadata.role`.
- Panggilan `users:upsertFromClerk` tidak mengirim role untuk existing user.
- Untuk create: default role `karyawan` diputuskan di Convex.

3. **`convex/users.js`**
- `upsertFromClerk`:
  - update existing: **jangan patch `role`**.
  - create baru: set default `karyawan`.
- `updateRole` tetap jadi satu-satunya mutasi role.

4. **`middleware.ts`**
- Hapus check admin/device berbasis `sessionClaims.metadata.role`.
- Middleware hanya:
  - allow public routes
  - redirect signin untuk protected routes

5. **Server Page guards**
- Ganti semua penggunaan `requireRolePage(...)` ke helper berbasis DB role:
  - `/dashboard`, `/settings`, `/device-qr` dan page protected lain.

6. **API route guards**
- Ganti semua `requireRoleApi(...)` ke DB-based guard:
  - `/api/admin/*`, `/api/device/*`, `/api/scan`.

7. **Convex hardening (defense in depth)**
- Tambahkan guard internal role di function sensitif yang belum self-guard:
  - `reports:listWeekly`
  - `reports:triggerWeeklyReport`
- Pastikan semua mutation/query sensitif validasi role via `requireRole` atau equivalent DB lookup.

---

## Detail Implementasi per File

1. `middleware.ts`
- Pertahankan route matcher publik/protected.
- Hapus `sessionClaims` role parsing.
- Untuk protected route: cek `userId` saja.

2. `lib/auth.ts`
- Tambah dependency `getConvexHttpClient`.
- Buat util `getDbUserByClerkId(clerkUserId)` lewat Convex query/mutation aman.
- Rework `requireRolePage` dan `requireRoleApi` agar:
  - 401 jika belum login
  - 403 jika DB role tidak sesuai
  - fallback aman jika user belum tersinkron (trigger sync atau return forbidden terstruktur)

3. `app/api/sync-user/route.ts`
- Remove metadata role logic.
- Call `users:upsertFromClerk` dengan payload profile saja.

4. `convex/users.js`
- `upsertFromClerk` patch existing: update non-role fields saja.
- Document invariant: role immutable via sync path.

5. `app/*` pages + `app/api/*` handlers
- Replace old helpers to DB-role helpers.
- Response message tetap konsisten (`Unauthorized` / `Forbidden`).

6. `convex/reports.js`
- Tambahkan `requireRole(ctx, ['admin','superadmin'])` untuk `listWeekly`.
- `triggerWeeklyReport` action:
  - validasi identity + DB role sebelum menjalankan internal action.

---

## Edge Cases & Failure Modes

1. **User belum punya row DB**
- `sync-user` bootstrap auto-create role `karyawan`.
- Jika endpoint sensitif diakses sebelum sync selesai: return 403/`USER_NOT_FOUND` yang eksplisit.

2. **Role baru diubah oleh superadmin**
- Efek akses mengikuti DB immediately (tanpa tunggu token refresh).

3. **Clerk metadata stale/berbeda**
- Tidak mempengaruhi authorization lagi.

4. **Convex unavailable**
- Endpoint protected return 500 terstruktur, tidak fallback ke role Clerk.

---

## Rencana Testing

1. **Unit/Integration auth helper**
- `requireRoleApiFromDb`:
  - unauthenticated -> 401
  - user tidak ada -> 403/404 sesuai kontrak
  - role mismatch -> 403
  - role match -> pass

2. **Route tests**
- `/api/admin/*`:
  - `karyawan` ditolak 403
  - `admin/superadmin` lolos
- `/api/device/*`:
  - hanya `device-qr` lolos
- `/api/scan`:
  - hanya `karyawan` lolos

3. **Page guard tests**
- `/dashboard` dan `/settings`:
  - role mismatch redirect/forbidden sesuai desain.
- `/device-qr`:
  - non-device ditolak.

4. **Sync invariants**
- Existing user role tidak berubah walau Clerk metadata berbeda.
- New user selalu default `karyawan`.

5. **Defense in depth**
- Panggilan langsung ke `reports:listWeekly` sebagai non-admin harus gagal.

---

## Acceptance Criteria

1. Tidak ada lagi pembacaan `sessionClaims.metadata.role` untuk authorization.
2. Tidak ada lagi pembacaan `publicMetadata.role` untuk menulis role DB.
3. Semua check role sensitif berasal dari `users.role` Convex.
4. Role change di DB langsung mempengaruhi akses tanpa bergantung refresh token.
5. Semua endpoint admin/device/scan tetap lolos smoke test sesuai matrix role.

---

## Asumsi & Default yang Dikunci

1. Default role user baru: `karyawan`.
2. Role management tetap lewat mutation Convex internal (superadmin-only).
3. Middleware tetap dipertahankan untuk authN (bukan authZ).
4. Tidak ada sinkronisasi balik role ke Clerk metadata.
