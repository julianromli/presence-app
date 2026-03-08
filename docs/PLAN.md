# Implementasi Notifikasi `/scan` untuk Karyawan

## Problem
Karyawan perlu melihat hasil scan dan status absensi penting hari ini tanpa membuka banyak halaman.

## Success Criteria
- badge unread di ikon bell akurat
- drawer menampilkan event yang relevan dalam urutan yang jelas
- notifikasi scan sukses dan gagal muncul dari data nyata
- reminder belum check-out muncul tanpa spam
- scope tetap kecil dan tidak berubah menjadi inbox umum

## Scope

### In Scope V1
- notifikasi persisten per `userId` dan `workspaceId`
- tipe `attendance_success`
- tipe `attendance_failure`
- tipe `attendance_reminder`
- tipe `workspace_announcement`
- list notifikasi saya
- mark single read
- mark all read
- unread count
- section `Perlu perhatian` dan `Terbaru`
- CTA ringan per item

### Out of Scope V1
- web push atau mobile push
- settings preferensi notifikasi
- hapus notifikasi
- filter kompleks
- kategori tambahan
- chat, mention, atau inbox umum
- editor announcement yang kompleks

## Prinsip Produk
- notifikasi di `/scan` adalah pendamping absensi, bukan pusat pesan perusahaan
- notifikasi harus relevan dengan absensi hari ini atau operasional yang langsung memengaruhi absensi
- drawer harus cepat dipindai dan tidak menduplikasi halaman riwayat
- setiap item idealnya punya aksi yang jelas atau paling tidak konteks yang langsung berguna

## Data Model
Tambahkan tabel baru di Convex, misalnya `employee_notifications`.

### Field Minimum
- `workspaceId`
- `userId`
- `type`
- `title`
- `description`
- `severity`
- `createdAt`
- `readAt?`
- `actionType?`
- `actionPayload?`
- `sourceKey?`
- `expiresAt?`
- `metadata?`

### Enum yang Disarankan
- `type`
  - `attendance_success`
  - `attendance_failure`
  - `attendance_reminder`
  - `workspace_announcement`
- `severity`
  - `info`
  - `success`
  - `warning`
  - `critical`
- `actionType`
  - `open_scan`
  - `open_history`
  - `open_history_day`
  - `none`

### `sourceKey`
`sourceKey` dipakai untuk dedupe.

Contoh:
- `attendance_success:2026-03-08:check-in:user_123`
- `attendance_failure:GEOFENCE:2026-03-08T08:user_123`
- `attendance_reminder:checkout:2026-03-08:user_123`

## Index Convex
Minimal:
- by user + workspace + createdAt desc
- by user + workspace + readAt
- by sourceKey

Ini cukup untuk:
- list cepat
- unread count
- dedupe event

## Backend Functions

### Query
- `notifications:listMine`
  - args: `limit`, optional `cursor`
  - returns: `items`, `unreadCount`, `pageInfo`

### Mutation
- `notifications:markRead`
  - args: `notificationId`

### Mutation
- `notifications:markAllRead`
  - args: none atau `beforeTs?`

### Internal Mutation atau Helper
- `notifications:createOrMerge`
  - dipakai oleh trigger absensi dan reminder
  - cek `sourceKey` untuk dedupe

### Opsional Phase Berikutnya
- `notifications:createAnnouncement`
  - untuk admin-side create announcement
  - tidak wajib untuk v1 awal bila belum ada kebutuhan nyata

## Trigger Notifikasi

### 1. Attendance Success
Buat notifikasi saat:
- scan accepted check-in
- scan accepted check-out

Perilaku:
- buat notifikasi baru
- CTA: `open_history_day`

### 2. Attendance Failure
Buat notifikasi saat scan rejected dengan alasan yang actionable.

Contoh:
- geofence
- akurasi GPS
- whitelist IP
- QR expired atau invalid

Perilaku:
- dedupe per reason dalam window pendek, misalnya 5 menit

### 3. Attendance Reminder
Reminder awal v1 hanya satu:
- belum check-out

Rule:
- user sudah check-in hari ini
- belum check-out
- waktu sudah lewat threshold, misalnya `16:30` atau mengikuti setting workspace bila sudah ada
- belum pernah dibuat reminder hari itu

Perilaku:
- maksimal 1 reminder per hari per user

### 4. Workspace Announcement
Announcement bersifat operasional ringan.

Contoh:
- perubahan jam kerja hari ini
- maintenance absensi
- aturan scan khusus hari tertentu

Rule:
- ditujukan ke semua karyawan di workspace
- boleh punya `expiresAt`
- bila expired, tidak tampil

## API Layer
Tambahkan route handler Next.js:
- `GET /api/karyawan/notifications`
- `POST /api/karyawan/notifications/read`
- `POST /api/karyawan/notifications/read-all`

Semua route:
- pakai auth dan workspace guard untuk role `karyawan`
- forward ke Convex function
- return payload ringan untuk client

Catatan:
- unread count cukup ikut payload `GET`
- tidak perlu route terpisah hanya untuk unread count

## Desain UI Drawer
Refactor [components/ui/scan-notifications-drawer.tsx](/D:/Projects/vibecode/presence-app/components/ui/scan-notifications-drawer.tsx) agar memakai data nyata.

### Struktur
- header `Notifikasi`
- badge unread
- tombol `Baca semua`
- section `Perlu perhatian`
- section `Terbaru`

### Aturan Pengelompokan
- `Perlu perhatian`
  - item `warning` dan `critical`
  - unread diprioritaskan
- `Terbaru`
  - item lain diurutkan `createdAt desc`

### Card Item
- icon sesuai `type` atau `severity`
- title
- description maksimal 1 sampai 2 baris
- relative time
- unread dot
- CTA kecil sesuai `actionType`

### Empty State
- pesan sederhana seperti `Belum ada notifikasi baru`
- tidak terlalu generik

### Error State
- tampilkan pesan gagal load
- tombol retry

### Loading State
- 3 sampai 4 skeleton cards

## Navigasi per Item
Mapping awal yang sederhana:
- `open_scan` -> `/scan`
- `open_history` -> `/scan/history`
- `open_history_day` -> `/scan/history`

Catatan:
- v1 tidak perlu URL state atau filter tanggal khusus
- buka halaman target dulu, penyempurnaan deep-link bisa menyusul

## Bell Badge
Di halaman berikut:
- `/scan`
- `/scan/history`
- `/scan/profile`

Perilaku:
- tampilkan dot atau angka kecil jika `unreadCount > 0`
- sebaiknya memakai sumber data yang sama dengan drawer
- hindari fetch terpisah di tiap halaman jika bisa dishare lewat hook atau payload yang sama

## Anti-Spam Rules
- failure notif dengan reason sama dalam 5 menit -> merge atau update existing
- reminder check-out maksimal 1 per hari
- success notif normalnya maksimal 2 per hari: check-in dan check-out
- announcement tidak di-generate berulang

Tujuan:
- drawer tidak penuh event minor atau duplikat

## Hubungan dengan Halaman Riwayat
- `Riwayat` menjawab: apa yang terjadi dalam periode tertentu
- `Notifikasi` menjawab: apa yang perlu saya tahu sekarang

Artinya:
- drawer notifikasi tidak boleh menjadi salinan penuh history
- item notifikasi boleh mengarahkan user ke history bila perlu konteks lebih lengkap

## Implementation Order
1. Tambah schema dan index Convex
2. Tambah query dan mutation notifications
3. Tambah route handlers Next
4. Refactor drawer ke data nyata
5. Tambah trigger attendance success dan failure
6. Tambah reminder belum check-out
7. Tambah announcement bila memang masih dibutuhkan

## Test Plan

### Backend
- create success notification
- dedupe failure notification
- mark read
- mark all read
- unread count benar
- reminder tidak duplikat

### UI
- loading state
- empty state
- error state
- unread badge muncul
- click item mark as read
- `Baca semua` bekerja
- CTA navigasi benar

### Regression
- `/scan`, `/scan/history`, `/scan/profile` tetap stabil
- workspace boundary tetap aman
- user hanya bisa melihat notif dari workspace sendiri

## Definition of Done
V1 dianggap selesai jika:
- drawer notifikasi tidak lagi mock
- scan sukses dan gagal menghasilkan notifikasi nyata
- unread dan read persisten
- reminder belum check-out berfungsi
- tidak ada fitur tambahan di luar empat tipe v1

## Catatan Scope Discipline
Jika ada ide tambahan di tengah implementasi, jangan langsung dimasukkan ke v1.

Tambahan berikut otomatis deferred:
- push notification
- preference center
- delete all
- kategori baru
- segmentasi announcement kompleks
- inbox perusahaan umum
