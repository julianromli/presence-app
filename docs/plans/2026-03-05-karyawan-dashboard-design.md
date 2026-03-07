# Karyawan Dashboard Design (MVP)

Date: 2026-03-05  
Project: Absenin.id App  
Scope: Dashboard khusus role `karyawan` untuk monitoring absensi personal dengan analytics, tabel, dan gamifikasi ringan.

## 1. Context and Goals

Dashboard saat ini masih berorientasi operasional admin. Kebutuhan baru adalah pengalaman khusus `karyawan` yang fokus ke data dirinya sendiri, interaktif, dan memotivasi perilaku hadir tepat waktu.

Tujuan utama MVP:
- Menampilkan insight disiplin waktu pribadi yang mudah dipahami.
- Menyediakan tabel riwayat absensi personal yang bisa difilter.
- Menambahkan gamifikasi ringan (points, badge, leaderboard mingguan) agar lebih engaging.

Out of scope MVP:
- Rule engine gamifikasi yang fully configurable.
- Real-time event stream kompleks.
- Sistem challenge multi-tenant yang sangat fleksibel.

## 2. Product Decisions (Validated)

- Prioritas: `Analytics-first`.
- Metrik utama bagian atas: `Disiplin waktu`.
- Gamifikasi: `Leaderboard ringan` antar karyawan.
- Definisi tepat waktu: `Jam tetap workspace` (contoh `08:00`) sebagai acuan tunggal.

## 3. High-Level Architecture

### 3.1 Role & Routing

- Tambahkan jalur dashboard khusus `karyawan` pada area dashboard yang sudah ada.
- `admin/superadmin` tetap memakai dashboard operasional eksisting.
- `karyawan` diarahkan ke dashboard personal.

### 3.2 Backend (Convex)

Tambahkan query baru untuk employee dashboard, contoh:
- `dashboardEmployee.getOverview`
- `dashboardEmployee.getAttendanceHistory`
- `dashboardEmployee.getLeaderboard`

Semua query:
- Wajib validasi role `karyawan` dalam workspace aktif.
- Hard-scope data ke user login (tidak menerima userId bebas dari client).

### 3.3 Frontend (Next.js App Router)

Gunakan App Router dan struktur komponen dashboard yang sudah ada untuk:
- Halaman ringkasan personal.
- Halaman riwayat absensi.
- Halaman leaderboard.

Komponen interaktif (filter range, tabel client behavior, progress badge) tetap client-side seperlunya, sementara data utama diambil dari server query.

## 4. UX Structure and Component Plan

### 4.1 Ringkasan Saya (`/dashboard`)

Blok utama:
- 3 cards: `Rata-rata Check-in`, `Tepat Waktu Minggu Ini`, `Perubahan vs Minggu Lalu`.
- Chart tren 14 hari (jam check-in harian + garis target jam workspace).
- Panel “insight cepat” yang memberi feedback naratif singkat.

### 4.2 Riwayat Absensi (`/dashboard/attendance`)

Tabel personal dengan kolom:
- Tanggal
- Jam check-in
- Jam check-out
- Status (`on-time`/`late`/`incomplete`)
- Durasi kerja
- Catatan edit (jika ada)

Filter:
- Minggu ini
- Bulan ini
- Custom range

Paging:
- Cursor-based pagination untuk performa stabil.

### 4.3 Leaderboard (`/dashboard/leaderboard`)

Konten:
- Top ranking mingguan berbasis poin disiplin.
- Posisi user selalu dipin (meskipun di luar top list).
- Progress badge dan target berikutnya.

## 5. Scoring and Gamification Rules (MVP)

Perhitungan poin mingguan:
- `+10` per hari `on-time`
- `+4` jika check-out valid tercatat
- Bonus streak `+5` tiap kelipatan 3 hari on-time beruntun
- Penalti `-3` per hari terlambat

`discipline score`:
- Dinormalisasi ke skala 0-100 terhadap hari kerja berjalan.

Badge:
- Bronze: 30 poin
- Silver: 60 poin
- Gold: 90 poin

Prinsip:
- Deterministik, mudah dijelaskan, dan ringan untuk MVP.

## 6. Data Flow

Ringkasan:
- Server resolve workspace aktif + session role.
- Query overview menghitung metrik personal dari absensi existing.

Riwayat:
- Client mengirim filter periode.
- Query mengembalikan hasil paginated yang sudah scoped ke user.

Leaderboard:
- Query agregasi poin mingguan workspace.
- Query rank pribadi dikembalikan terpisah agar user selalu punya konteks.

## 7. Error Handling and Reliability

- Authorization error: blok akses lintas role/workspace.
- Data quality error: record tidak lengkap ditandai `incomplete`, tidak memblokir panel lain.
- Partial failure UI: jika leaderboard gagal, panel lain tetap tampil dan leaderboard memberi retry state.

## 8. Testing Strategy (MVP)

Unit tests:
- Perhitungan `on-time` berdasarkan cutoff jam workspace.
- Perhitungan poin, streak, dan normalisasi discipline score.

Integration tests:
- Query Convex tidak boleh membocorkan data antar user.
- Scoping workspace aktif berjalan benar.

Component/UI tests:
- Filter tabel periode dan empty state.
- Tampilan fallback saat panel tertentu gagal.

Smoke tests:
- Routing role: `admin/superadmin` ke dashboard operasional, `karyawan` ke dashboard personal.

## 9. Delivery Plan (Recommended)

Phase 1:
- Role routing + halaman shell employee dashboard.

Phase 2:
- Overview analytics + score + trend.

Phase 3:
- Attendance table dengan filter dan pagination.

Phase 4:
- Leaderboard + badge progress + hardening tests.
