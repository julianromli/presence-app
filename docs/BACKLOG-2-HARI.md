# Backlog Implementasi 2 Hari - Presence MVP

Tanggal eksekusi: 2-3 Maret 2026  
Target rilis MVP: 4 Maret 2026
Status: Revisi matang (berbasis riset Context7)

## Prinsip Eksekusi
- Fokus `P0` dulu, `P1` hanya jika seluruh P0 lulus verifikasi.
- Authorization wajib berlapis: middleware + server handler/mutation.
- Setiap task harus punya output terverifikasi, bukan hanya "sudah coding".

## Definisi Prioritas
- `P0`: blocker MVP, wajib selesai.
- `P1`: peningkatan kualitas, dikerjakan jika waktu cukup.

## Backlog Task-by-Task

| ID | Task | Pri | Estimasi | Dependensi | Deliverable | Verification Gate |
|---|---|---:|---:|---|---|---|
| T01 | Setup env, secrets, dan baseline app | P0 | 1 jam | - | `.env` tervalidasi, app bisa `dev` | App boot tanpa error runtime |
| T02 | Integrasi Clerk (sign-in/sign-up/sign-out) | P0 | 1.5 jam | T01 | Auth flow aktif | Login/logout sukses end-to-end |
| T03 | Implement Clerk middleware (public/protected/API matcher) | P0 | 1 jam | T02 | `middleware.ts` protect route | Route privat redirect saat unauth |
| T04 | RBAC server-side di Route Handler/Server Action | P0 | 2 jam | T02, T03 | Guard role `Superadmin/Admin/Karyawan/device-qr` | Endpoint sensitif return 401/403 sesuai role |
| T05 | Desain schema Convex + indeks komposit | P0 | 2 jam | T01 | `users`, `attendance`, `settings`, `qr_tokens`, `audit_logs`, `weekly_reports` | Query utama berjalan via index, tanpa full scan |
| T06 | Sinkronisasi user Clerk -> Convex (upsert role/user) | P0 | 1.5 jam | T02, T05 | user profile konsisten lintas sistem | User baru login langsung punya row `users` |
| T07 | Halaman `device-qr` fullscreen + guard role | P0 | 1.5 jam | T04, T05 | QR display page aktif | Role selain `device-qr` ditolak |
| T08 | QR token service (signed, TTL 5 detik, single-use nonce) | P0 | 2.5 jam | T07 | Generate/verify token aman | Token expired/replay ditolak |
| T09 | Endpoint scan + anti-spam + check datang/pulang | P0 | 3 jam | T08, T05 | Absensi valid tersimpan | Scan valid <=2 detik p95 (uji lokal) |
| T10 | Settings Superadmin (timezone, geofence, IP whitelist toggle) | P0 | 2 jam | T04, T05 | Settings page + persistence | Toggle berpengaruh ke validasi scan |
| T11 | Dashboard dasar Admin/Superadmin (list/filter/status) | P0 | 2 jam | T09, T04 | Tabel absensi harian | Data tampil sesuai role & filter |
| T12 | Cron export mingguan `.xlsx` + penyimpanan hasil | P0 | 3 jam | T09, T05 | Job mingguan + file report | File berisi kolom wajib dan status tercatat |
| T13 | Audit log untuk edit absensi dan perubahan settings | P0 | 1.5 jam | T10, T11 | `audit_logs` terisi event kritikal | Semua edit manual punya jejak actor/timestamp |
| T14 | QA E2E + hardening + bugfix | P0 | 3 jam | T01-T13 | Checklist rilis terpenuhi | Semua skenario P0 lulus |
| T15 | Landing page polish (mobile-first, minimalist) | P1 | 1.5 jam | T02 | LP siap demo | Lighthouse mobile tidak regress besar |
| T16 | KPI cards analytics (5 metrik inti) | P1 | 1.5 jam | T11 | Cards KPI dasar | Nilai KPI konsisten dengan data tabel |

## Critical Path (Wajib Dijaga)
1. T01 -> T02 -> T03 -> T04
2. T05 -> T06
3. T07 -> T08 -> T09
4. T10 -> T11 -> T12 -> T13
5. T14

## Rencana Hari 1 (2 Maret 2026)
1. T01-T06 (fondasi auth, RBAC, schema, sync user).
2. T07-T09 (alur utama QR dan scan datang/pulang).
3. Smoke test 4 skenario:
   - scan valid,
   - token expired,
   - replay token,
   - role unauthorized.

## Rencana Hari 2 (3 Maret 2026)
1. T10-T13 (settings policy, dashboard, cron export, audit log).
2. T14 (regresi dan hardening sebelum release).
3. Jika waktu tersisa: T15-T16.

## Checklist Verifikasi Wajib Sebelum Rilis
- Auth + RBAC:
  - route privat tidak bisa diakses tanpa login.
  - role check server-side aktif di endpoint sensitif.
- Security scan:
  - token QR expired ditolak.
  - replay scan ditolak.
  - anti-spam window aktif.
- Data integrity:
  - datang/pulang tidak tertukar.
  - edit absensi tercatat di audit log.
- Reporting:
  - cron mingguan menghasilkan `.xlsx` dengan kolom:
    - Minggu Ke-
    - Nama Karyawan
    - Jam Datang
    - Jam Pulang
    - Tanggal Kehadiran
    - Edited atau Tidak
- Operasional:
  - log reject reason tersedia.
  - fallback bila geofence/IP whitelist dimatikan tetap stabil.

## Exit Criteria MVP (4 Maret 2026)
- Semua task `P0` selesai dan lulus verification gate.
- Tidak ada bug kritikal pada auth, scan, dan export report.
- Superadmin dapat mengelola policy inti tanpa deploy ulang.
