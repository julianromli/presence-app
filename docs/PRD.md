# PRD - Presence (Absensi Digital)

Tanggal dokumen: 2 Maret 2026  
Target MVP: 4 Maret 2026 (2 hari)
Status: Revisi matang (berbasis riset Next.js 16.1.6, Clerk, Convex)

## 1. Executive Summary

**Problem Statement**  
Perusahaan membutuhkan sistem absensi yang cepat, aman, dan minim kecurangan, sekaligus mudah dipakai oleh karyawan dan admin. Rekap manual mingguan lambat, rawan human error, dan sulit diaudit.

**Proposed Solution**  
`Presence` adalah aplikasi absensi digital dengan QR dinamis (rotasi 5 detik), role-based access (`superadmin`, `admin`, `karyawan`, `device-qr`), dashboard operasional, dan ekspor report Excel mingguan otomatis. Sistem menerapkan validasi berlapis: middleware auth, otorisasi server-side, token QR signed + TTL, anti-spam, dan opsi geofence/IP whitelist.

**Success Criteria (MVP)**
- Tingkat keberhasilan absensi valid >= 99.5% per bulan.
- Latensi dari scan valid sampai data tersimpan <= 2 detik (p95).
- Menangani >= 100 karyawan aktif tanpa error rate backend > 0.5%.
- Uptime aplikasi >= 99.9% (target operasional 24/7).
- Report mingguan `.xlsx` ter-generate otomatis <= 60 detik setelah jadwal cron.

## 2. User Experience & Functionality

**User Personas**
- Superadmin: Mengatur role, kebijakan keamanan, timezone, dan audit.
- Admin: Memantau absensi, memperbaiki data jika diperlukan, dan ekspor report.
- Karyawan: Scan QR untuk datang/pulang dengan langkah minimum.
- Device-QR (`device-qr`): Akun khusus yang menampilkan QR fullscreen di perangkat kantor.

**User Stories**
- As a Karyawan, I want to scan QR untuk absensi datang/pulang so that proses absen cepat dan minim antre.
- As an Admin, I want to melihat rekap harian/mingguan so that saya bisa memantau disiplin tim.
- As an Admin, I want to menerima export mingguan otomatis so that pelaporan ke atasan konsisten.
- As a Superadmin, I want to atur timezone, geofence, dan IP whitelist so that kebijakan absensi bisa dikontrol.
- As a Superadmin, I want to mengelola role pengguna so that akses sensitif tetap terbatas.
- As a Device-QR account, I want to menampilkan QR dinamis so that setiap scan tervalidasi token aktif.

**Acceptance Criteria**
- QR dinamis rotasi tepat tiap 5 detik; token lama invalid otomatis.
- Scan pertama per hari = `jam datang`, scan valid berikutnya = `jam pulang`.
- Duplicate scan event yang sama dalam 30 detik ditolak (anti-spam).
- Jika geofence aktif, scan di luar radius ditolak dengan error reason terstruktur.
- Jika IP whitelist aktif, scan dari IP di luar daftar ditolak.
- Dashboard hanya untuk `Admin`/`Superadmin`.
- Hanya role `device-qr` bisa membuka halaman display QR.
- Setiap edit data absensi oleh admin tercatat ke audit log.
- Export mingguan memuat kolom: `Minggu Ke-`, `Nama Karyawan`, `Jam Datang`, `Jam Pulang`, `Tanggal Kehadiran`, `Edited atau Tidak`.

**Non-Goals (MVP)**
- Payroll, perhitungan gaji, dan integrasi HRIS.
- Face recognition/selfie verification.
- Multi-cabang dengan policy shift kompleks.
- AI insight produksi (hanya future-ready).

## 3. AI System Requirements (If Applicable)

**Tool Requirements**
- MVP: Tidak wajib AI.
- Future-ready: `OpenRouter` model `gemini-3-flash` untuk insight anomali, ringkasan, dan tanya-jawab laporan.

**Evaluation Strategy (Future)**
- Akurasi insight terhadap data ground truth >= 90%.
- Hallucination rate <= 5%.
- Median latency inferensi <= 3 detik.
- Output AI harus menyertakan sumber data internal yang dirujuk.

## 4. Technical Specifications

**Architecture Overview**
- Frontend: Next.js 16.1.6 App Router, mobile-primary, minimalis.
- Auth: Clerk (`@clerk/nextjs`) untuk session + identity.
- DB/Backend: Convex untuk query/mutation, real-time subscription, dan cron.
- Storage: UploadThing untuk file hasil report dan aset lampiran.
- Attendance Flow:
  - `device-qr` login -> halaman QR generate token signed TTL 5 detik.
  - karyawan scan -> endpoint validasi token + policy keamanan -> mutation simpan absensi.
  - dashboard admin update real-time.
- Reporting Flow:
  - cron mingguan -> query periode -> generate `.xlsx` -> simpan + catat status.

**Authorization Strategy (Hard Requirement)**
- Layer 1: Clerk middleware untuk protect route (public vs protected).
- Layer 2: Semua Route Handler/Server Action sensitif wajib verifikasi session + role di server (401/403).
- Layer 3: Guard di halaman Server Component admin menggunakan server-side role check.
- Catatan: Middleware saja tidak cukup; otorisasi tetap wajib di handler/mutation.

**Convex Data Model (MVP)**
- `users`:
  - `clerkUserId`, `name`, `email`, `role`, `isActive`, `createdAt`, `updatedAt`.
- `attendance`:
  - `userId`, `dateKey` (`YYYY-MM-DD` timezone kantor), `checkInAt`, `checkOutAt`, `sourceDeviceId`, `edited`, `editedBy`, `editedAt`, `editReason`, `createdAt`, `updatedAt`.
- `settings`:
  - `timezone` (default `Asia/Jakarta`), `geofenceEnabled`, `geofenceRadiusMeters`, `whitelistEnabled`, `whitelistIps`.
- `qr_tokens` (ephemeral/short-lived):
  - `tokenHash`, `deviceUserId`, `issuedAt`, `expiresAt`, `usedAt`, `nonce`.
- `audit_logs`:
  - `actorUserId`, `action`, `targetType`, `targetId`, `payload`, `createdAt`.
- `weekly_reports`:
  - `weekKey`, `startDate`, `endDate`, `fileUrl`, `status`, `generatedAt`, `errorMessage`.

**Index Strategy (Convex Best Practice)**
- Gunakan indeks komposit untuk menghindari indeks redundant.
- Contoh indeks utama:
  - `attendance.by_user_and_date` -> `[userId, dateKey]`
  - `attendance.by_date_and_user` -> `[dateKey, userId]`
  - `attendance.by_date_and_edited` -> `[dateKey, edited]`
  - `users.by_clerk_user_id` -> `[clerkUserId]`
  - `weekly_reports.by_week_key` -> `[weekKey]`

**Time & Scheduler Rules**
- Timezone operasional MVP: `Asia/Jakarta` (UTC+7), dapat diubah Superadmin.
- Semua timestamp disimpan UTC; `dateKey` diturunkan dari timezone kantor.
- Cron report dieksekusi mingguan pada waktu tetap (misal Senin 08:00 WIB = Minggu 01:00 UTC).

**Security & Privacy**
- HTTPS only; secret key tidak boleh terekspos ke client.
- QR token signed + nonce + TTL 5 detik + single-use.
- Rate limiting endpoint scan dan deteksi replay.
- Opsi geofence/IP whitelist dapat diaktifkan per kebijakan kantor.
- Semua perubahan manual absensi wajib audit trail lengkap.
- RBAC enforcement wajib di server handler + Convex mutation.

**Observability & Operations**
- Logging minimum: success/fail scan, alasan reject, durasi mutation, status cron export.
- Alert minimum: gagal cron 2x berturut-turut, error rate scan > 2%, device-qr offline > 10 menit.

## 5. Risks & Roadmap

**Phased Rollout**
- MVP (4 Maret 2026): auth, role, QR dinamis, scan datang/pulang, dashboard dasar, settings keamanan, export mingguan.
- v1.1: shift/toleransi telat, notifikasi keterlambatan/missing checkout, analytics trend lanjutan.
- v2.0: multi-lokasi, AI insight, integrasi HRIS/payroll.

**Technical Risks & Mitigation**
- Risiko: Deadline 2 hari menekan testing.
  - Mitigasi: freeze scope ketat ke P0, jalankan smoke + role/security tests wajib.
- Risiko: bypass authorization jika hanya mengandalkan middleware.
  - Mitigasi: enforce role check di semua server handler/mutation sensitif.
- Risiko: false reject geofence/IP.
  - Mitigasi: default OFF, log reason detail, fallback policy override oleh Superadmin.
- Risiko: report mingguan gagal.
  - Mitigasi: idempotent cron job + retry + status tracking di `weekly_reports`.

## 6. Dashboard Metrics (Best Practices)
- Attendance Rate (harian/mingguan/bulanan).
- On-Time Rate.
- Late Rate (termasuk distribusi menit terlambat).
- Missing Checkout Rate.
- Edit Ratio.
- Scan Success Rate vs Rejection Rate.
- Security Rejection Breakdown (token expired/replay/geofence/IP).
- Device Uptime.
- Weekly Export Success Rate.

## 7. Referensi Teknis (Context7)
- Next.js 16.1.6: auth, data security, server-side authorization, `forbidden()`.
- Clerk Next.js: middleware route protection + role-based guarding.
- Convex: schema/index best practices + cron jobs untuk scheduling.
