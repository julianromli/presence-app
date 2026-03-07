# Technical Design v1: Multi-Workspace for Absenin.id

Tanggal: 4 Maret 2026
Status: Final draft implementable
Target: Mengubah Absenin.id dari single-tenant operasional menjadi multi-workspace SaaS dengan isolasi data per workspace.

## 1. Tujuan dan Scope

### Tujuan v1
- Satu user dapat menjadi member di lebih dari satu workspace.
- Semua data operasional terisolasi ketat per workspace.
- Role dan izin berlaku per workspace, bukan global.
- User dapat memilih workspace aktif dari UI.
- Tetap backward-compatible lewat migrasi bertahap dari model saat ini.

### In Scope
- Data model multi-workspace di Convex.
- Refactor authorization helper menjadi workspace-scoped.
- Workspace context di API (`x-workspace-id`).
- Refactor flow utama: users admin, settings, QR device, scan attendance, report.
- Migrasi data dari mode global ke default workspace.
- Test isolation dan anti-cross-tenant access.

### Out of Scope (v1)
- Billing/subscription per workspace.
- RBAC custom granular per permission key.
- Workspace invitation email automation kompleks.
- Cross-workspace analytics aggregate.

## 2. Kondisi Saat Ini (Baseline)

Kondisi codebase saat dokumen ini dibuat:
- `users` menyimpan `role` global.
- `settings` berbasis `key: "global"`.
- `users_metrics` berbasis `key: "global"`.
- Tabel operasional (`attendance`, `qr_tokens`, `scan_events`, `audit_logs`, `weekly_reports`) belum memiliki `workspaceId`.
- Authorization helper utama (`convex/helpers.js`) memakai role global user.

Implikasi:
- Tidak ada boundary tenant eksplisit di level data dan query.
- Belum aman untuk skenario SaaS multi-workspace real-user.

## 3. Arsitektur Data Target

## 3.1 Tabel baru

### `workspaces`
Field:
- `slug: string` (unik)
- `name: string`
- `isActive: boolean`
- `createdAt: number`
- `updatedAt: number`
- `createdByUserId?: Id<"users">`

Index:
- `by_slug: [slug]`

### `workspace_members`
Field:
- `workspaceId: Id<"workspaces">`
- `userId: Id<"users">`
- `role: "superadmin" | "admin" | "karyawan" | "device-qr"`
- `isActive: boolean`
- `createdAt: number`
- `updatedAt: number`

Index:
- `by_workspace_and_user: [workspaceId, userId]` (unik)
- `by_user_and_workspace: [userId, workspaceId]`
- `by_workspace_role_active: [workspaceId, role, isActive]`

Catatan:
- v1 menggunakan `workspace_members` untuk semua role termasuk `device-qr`.
- Tabel device terpisah belum diperlukan di v1.

### `workspace_invite_codes`
Field:
- `workspaceId: Id<"workspaces">`
- `code: string` (unik global, disimpan uppercase normalized)
- `isActive: boolean`
- `expiresAt?: number` (optional)
- `createdByUserId: Id<"users">`
- `createdAt: number`
- `updatedAt: number`
- `lastRotatedAt?: number`

Index:
- `by_code: [code]` (unik)
- `by_workspace: [workspaceId]`

Aturan v1:
- Satu workspace memiliki satu invite code aktif default.
- Code bersifat reusable (bisa dipakai banyak user).
- Superadmin workspace dapat rotate code kapan saja.
- Expiry bersifat optional (default: tidak expired).

## 3.2 Tabel existing: wajib tambah `workspaceId`

Tambahkan `workspaceId` pada:
- `attendance`
- `settings`
- `qr_tokens`
- `device_heartbeats`
- `scan_events`
- `audit_logs`
- `weekly_reports`
- `users_metrics`

`users` tetap menjadi global identity table (mapping Clerk user), tanpa role global sebagai source of truth.

## 3.3 Konvensi index baru (minimum)

Tambahan index minimum:
- `attendance.by_workspace_and_date_user: [workspaceId, dateKey, userId]`
- `attendance.by_workspace_user_date: [workspaceId, userId, dateKey]`
- `settings.by_workspace: [workspaceId]`
- `qr_tokens.by_workspace_token_hash: [workspaceId, tokenHash]`
- `scan_events.by_workspace_date_status: [workspaceId, dateKey, resultStatus]`
- `audit_logs.by_workspace_created: [workspaceId, createdAt]`
- `weekly_reports.by_workspace_week_key: [workspaceId, weekKey]`
- `users_metrics.by_workspace: [workspaceId]`
- `workspace_invite_codes.by_code: [code]`
- `workspace_invite_codes.by_workspace: [workspaceId]`

## 4. Authorization Model Baru

## 4.1 Prinsip
- AuthN: user identity dari Clerk.
- AuthZ: membership + role per workspace.
- Semua enforcement kritikal dilakukan server-side (route handler + convex mutation/query).

## 4.2 Helper baru di `convex/helpers.js`

Tambahkan helper berikut:
1. `requireIdentityUser(ctx)`
- Resolves Clerk identity ke row `users`.
- Menolak jika user tidak ditemukan / inactive.

2. `requireWorkspaceMember(ctx, workspaceId)`
- Ambil membership via index `by_workspace_and_user`.
- Menolak jika tidak ada member aktif.

3. `requireWorkspaceRole(ctx, workspaceId, allowedRoles)`
- Turunan dari helper di atas.
- Menolak jika role tidak termasuk allowedRoles.

Semua query/mutation sensitif wajib migrasi ke helper ini.

## 5. API Contract Workspace Context

## 5.1 Mekanisme context
Standar v1: gunakan header `x-workspace-id` untuk semua endpoint privat.

Aturan:
- Jika header tidak ada: `400` (`WORKSPACE_REQUIRED`).
- Jika workspace tidak valid: `400` (`WORKSPACE_INVALID`).
- Jika user bukan member aktif workspace: `403` (`FORBIDDEN`).

## 5.2 Titik enforcement
- Tambah helper API baru di `lib/auth.ts` / `lib/*`:
  - `requireWorkspaceApiContext(...)`
- Route handler admin/device/scan/settings/report wajib memanggil helper ini sebelum query/mutation.

## 5.3 Kompatibilitas
- Dalam masa migrasi, jika tenant mode belum diaktifkan, fallback ke default workspace boleh dipakai sementara.
- Setelah cutover, fallback dimatikan.

## 6. Perubahan Flow Utama

## 6.1 Auth onboarding flow (baru, wajib)
- Setelah sign-up/sign-in, user tidak langsung dianggap `karyawan`.
- Sistem cek membership aktif user:
  - Jika belum punya membership aktif: redirect ke onboarding.
  - Jika sudah punya membership aktif: lanjut ke workspace terakhir aktif.

Onboarding screen menampilkan dua opsi:
1. `Create new workspace`
2. `Join existing workspace`

### 6.1.1 Create new workspace
- User input nama workspace.
- Sistem membuat:
  - row `workspaces`
  - row `workspace_members` untuk user tersebut dengan role `superadmin`
  - row `workspace_invite_codes` default aktif
  - row `settings` untuk workspace baru (default policy)
  - row `users_metrics` untuk workspace baru (inisialisasi kosong)
- Workspace baru langsung menjadi active workspace user.

### 6.1.2 Join existing workspace
- User input invitation code.
- Sistem validasi:
  - code ditemukan
  - code aktif
  - jika `expiresAt` ada, belum lewat
- Jika valid:
  - buat membership user ke workspace target dengan role `karyawan`
  - jika membership sudah ada dan inactive, aktifkan kembali
  - jika membership sudah aktif, tidak duplikasi (idempotent join)
- Workspace target menjadi active workspace user.

## 6.2 Sync user (`/api/sync-user`)
- Tetap upsert identity ke `users`.
- Tidak menetapkan role global.
- Tidak membuat membership default otomatis.
- Membership hanya dibuat lewat:
  - onboarding `create workspace`
  - onboarding `join existing`
  - assignment/admin flow di workspace.

## 6.3 Users admin panel
- Source utama: `workspace_members` + join ke `users`.
- Filter/pagination/summary scoped by `workspaceId`.
- Update role/status memodifikasi membership, bukan global `users.role`.
- Superadmin dapat:
  - rotate invitation code workspace
  - mengatur status aktif/nonaktif membership
  - promosi role sesuai policy workspace.

## 6.4 Settings
- `settings:get` dan `settings:update` scoped by `workspaceId`.
- Tidak ada lagi record `key: "global"` sebagai source produksi.
- `superadmin` workspace-only dapat mengubah settings workspace tersebut.

## 6.5 Device QR token
- `qrTokens:issue` hanya untuk member role `device-qr` pada workspace aktif.
- Token menyimpan `workspaceId`.
- Validasi token wajib mengecek workspace match.

## 6.6 Scan attendance
- Actor harus member `karyawan` di workspace aktif.
- Validasi policy menggunakan settings workspace aktif.
- Write ke `attendance` + `scan_events` dengan `workspaceId`.
- Wajib reject cross-workspace token reuse.

## 6.7 Weekly report
- Cron/generate report per workspace.
- `weekly_reports` tersimpan per workspace.
- Download API hanya bisa akses report workspace aktif.

## 7. Strategy Migrasi Bertahap

## 7.1 Fase A - Expand schema (non-breaking)
- Tambah tabel `workspaces`, `workspace_members`.
- Tambah kolom `workspaceId` (sementara optional) ke tabel operasional.
- Tambah index baru.

## 7.2 Fase B - Bootstrap default workspace
- Buat 1 workspace default, contoh: `main-office`.
- Untuk semua `users` existing, buat `workspace_members`:
  - role dari field lama `users.role`.
  - `isActive` dari `users.isActive`.

## 7.3 Fase C - Backfill data
- Backfill `workspaceId` ke semua data existing operasional menggunakan default workspace.
- Bangun `users_metrics` per workspace.

## 7.4 Fase D - Cutover read/write
- Seluruh query/mutation pindah ke workspace-scoped path.
- Endpoint mewajibkan `x-workspace-id`.
- UI dashboard memakai workspace aktif.

## 7.5 Fase E - Cleanup
- Hapus ketergantungan pada role global:
  - deprecated `users.role` sebagai auth source.
  - deprecated settings `key: "global"`.
  - deprecated users_metrics `key: "global"`.

Catatan:
- Cleanup dilakukan hanya setelah 1-2 siklus stabil tanpa regresi.

## 8. UI/UX v1

## 8.1 Onboarding gate (entrypoint)
- Route baru: `/onboarding/workspace` (private).
- Trigger:
  - user signed-in
  - user belum memiliki membership aktif mana pun.
- Selama kondisi di atas, akses ke route app privat diarahkan ke onboarding.
- User tidak bisa bypass onboarding ke dashboard sebelum memilih `new/join`.

## 8.2 Onboarding screen
Konten utama:
- Headline: pilih cara mulai.
- Card action:
  - `Create new workspace`
  - `Join existing workspace`

### 8.2.1 Create new workspace form
- Input wajib: workspace name.
- CTA: `Create workspace`.
- Hasil sukses:
  - toast sukses
  - redirect ke dashboard workspace baru.

### 8.2.2 Join existing workspace form
- Input wajib: invitation code.
- CTA: `Join workspace`.
- Error states:
  - code tidak ditemukan
  - code nonaktif
  - code expired
- Hasil sukses:
  - toast sukses
  - redirect ke dashboard workspace tujuan.

## 8.3 Workspace switcher
- Lokasi: topbar/navbar dashboard.
- Menampilkan daftar workspace membership user.
- Simpan workspace aktif di cookie (contoh: `active_workspace_id`) + opsi persist last workspace.
- Saat sign-in berikutnya:
  - jika last workspace masih valid -> auto masuk workspace tersebut.
  - jika tidak valid -> fallback ke workspace aktif pertama.

## 8.4 Request propagation
- Semua fetch privat otomatis menyertakan `x-workspace-id` dari workspace aktif.

## 8.5 Empty state
- Jika user tidak punya membership aktif:
  - tampilkan state `No workspace access` + arahan hubungi admin.
- Untuk first-time user, empty state ini diarahkan ke onboarding form `new/join`.

## 8.6 Invitation code UX (matang)

Tujuan:
- Meminimalkan friksi join workspace.
- Menjaga keamanan akses workspace.
- Memberikan error feedback yang jelas dan actionable.

### 8.6.1 Surface area UI
1. `Onboarding Join` (`/onboarding/workspace`)
2. `Workspace Settings > Access` (superadmin only)
3. `Workspace switcher` (feedback setelah join sukses)

### 8.6.2 Onboarding Join interaction
- Form tunggal: `Invitation code`.
- Input behavior:
  - auto-uppercase.
  - trim spasi awal/akhir.
  - normalisasi paste code yang berisi spasi atau dash berlebih.
- CTA utama: `Join workspace`.
- CTA sekunder: `Create new workspace`.
- Helper text: `Minta kode undangan ke superadmin workspace Anda.`
- Loading:
  - tombol disabled + spinner + label `Joining...`.
- Success:
  - toast `Berhasil bergabung ke {workspaceName}`.
  - set active workspace ke workspace tujuan.
  - redirect ke dashboard workspace tersebut.

### 8.6.3 Error state mapping (wajib)
- `CODE_NOT_FOUND`:
  - message: `Kode undangan tidak ditemukan.`
  - helper: `Periksa ulang kode atau minta kode terbaru.`
- `CODE_INACTIVE`:
  - message: `Kode undangan sudah tidak aktif.`
  - helper: `Hubungi superadmin untuk kode baru.`
- `CODE_EXPIRED`:
  - message: `Kode undangan sudah kedaluwarsa.`
  - helper: `Minta kode baru dari superadmin.`
- `ALREADY_MEMBER`:
  - message: `Anda sudah menjadi anggota workspace ini.`
  - action: tombol `Go to workspace`.
- fallback generic:
  - message: `Gagal memproses permintaan. Coba lagi.`

### 8.6.4 Superadmin access management UX
Lokasi: settings workspace, section `Access`.

Komponen `Invitation code card`:
- Tampilkan code aktif (masked by default).
- Tombol `Reveal/Hide`.
- Tombol `Copy code`.
- Status chip:
  - `Active`
  - `Inactive`
  - `Expires {date}` jika memiliki expiry.

Aksi superadmin:
- `Rotate code`:
  - wajib modal konfirmasi.
  - copy modal: `Kode lama akan berhenti berlaku segera.`
  - confirm checkbox: `Saya paham anggota baru harus memakai kode baru.`
- `Enable/Disable code` toggle.
- `Expiry` selector:
  - `No expiry` (default)
  - `1 day`
  - `7 days`
  - `30 days`
  - `Custom date`

### 8.6.5 Safety and abuse protection UX
- Rate-limit join attempts (contoh baseline v1: 5 percobaan / 5 menit / user).
- Jika limit kena:
  - message: `Terlalu banyak percobaan. Coba lagi dalam beberapa menit.`
- Audit log event wajib:
  - join success
  - join failed (dengan `reasonCode`)
  - code rotated
  - code enabled/disabled
- Di onboarding, jangan tampilkan metadata sensitif workspace.

### 8.6.6 Edge state UX
- Join sukses namun workspace nonaktif:
  - jangan set active workspace.
  - tampilkan error: `Workspace sedang nonaktif.`
- User tanpa membership aktif:
  - selalu diarahkan ke onboarding.
- User multi-workspace:
  - setelah join, switcher harus langsung menampilkan workspace baru.

### 8.6.7 Microcopy default (locked)
- Input label: `Invitation code`
- Placeholder: `Contoh: TEAM-7K4M-ABSENIN`
- CTA join: `Join workspace`
- CTA create: `Create new workspace`
- Success toast join: `Berhasil bergabung ke {workspaceName}`

### 8.6.8 Telemetry event (recommended)
- `onboarding_join_viewed`
- `onboarding_join_submitted`
- `onboarding_join_succeeded`
- `onboarding_join_failed` (sertakan `reasonCode`)
- `invite_code_rotated`
- `invite_code_copied`

## 9. Testing dan Acceptance Criteria

## 9.1 Unit tests
- `requireWorkspaceMember`:
  - pass untuk member aktif.
  - fail untuk non-member / inactive.
- `requireWorkspaceRole`:
  - pass role cocok.
  - fail role mismatch.

## 9.2 API tests
- Semua endpoint sensitif reject request tanpa `x-workspace-id`.
- Semua endpoint sensitif reject cross-workspace access.
- Device token workspace mismatch ditolak.
- Join workspace:
  - code valid -> membership `karyawan` tercipta.
  - code invalid/inactive/expired -> reject.
- Create workspace:
  - creator otomatis menjadi `superadmin`.

## 9.3 Integration tests
- User di workspace A tidak melihat data workspace B.
- Report/download hanya data workspace aktif.

## 9.4 Acceptance criteria v1
- Tidak ada data leakage antar workspace pada endpoint admin/device/scan/report.
- Role enforcement seluruhnya workspace-scoped.
- Flow check-in/check-out tetap berjalan normal per workspace.
- Dashboard users/settings/report menampilkan data workspace aktif saja.
- User baru tidak otomatis menjadi `karyawan` global.
- User baru wajib melewati onboarding `new/join` sebelum akses dashboard.
- Join via invitation code selalu memberi role `karyawan`.
- Create workspace selalu memberi role `superadmin` untuk creator.

## 10. Urutan Implementasi Sprint (disarankan)

1. Schema foundation:
- tambah tabel `workspaces`, `workspace_members`, `workspace_invite_codes`, field `workspaceId` + index.

2. Auth helper refactor:
- implement `requireWorkspaceMember` + `requireWorkspaceRole`.

3. API context layer:
- implement helper `x-workspace-id` di route handler.

4. Refactor domain inti:
- `settings`, `qrTokens`, `attendance/scan`, `reports`, `users admin`, `invite code`.

5. UI switcher:
- tambah onboarding gate + form `new/join`, workspace selector, dan request propagation.

6. Migrasi + backfill:
- bootstrap default workspace dan backfill existing data.

7. Hardening:
- tambah test isolation, jalankan pilot workspace terbatas.

## 11. Risiko dan Mitigasi

Risiko:
- Bug data leakage jika ada query lama tanpa filter workspace.
Mitigasi:
- Audit semua query/mutation + checklist enforcement workspace wajib.

Risiko:
- Migrasi role global ke membership tidak konsisten.
Mitigasi:
- Script migrasi idempotent + log hasil per user.

Risiko:
- Device QR salah workspace saat operasional.
Mitigasi:
- Embed `workspaceId` di token + validasi strict saat scan.

Risiko:
- Rollout terlalu cepat ke seluruh user.
Mitigasi:
- Pilot 1 workspace dulu, lalu bertahap ke workspace lain.

## 12. Keputusan Default v1 (locked)
- Workspace context channel: header `x-workspace-id`.
- `users` tetap global identity; role source pindah ke `workspace_members`.
- `device-qr` tetap role dalam `workspace_members` (tanpa tabel device khusus di v1).
- Migrasi dilakukan bertahap (expand -> backfill -> cutover -> cleanup), bukan big-bang.
- Invitation code: reusable, dapat di-rotate superadmin, expiry optional.
- Post sign-in behavior:
  - punya membership aktif -> auto redirect ke last active workspace.
  - belum punya membership -> wajib onboarding `new/join`.
- Join workspace via invitation code: role default selalu `karyawan`.
- Create workspace: creator otomatis `superadmin` workspace tersebut.
- User boleh memiliki lebih dari satu workspace.
