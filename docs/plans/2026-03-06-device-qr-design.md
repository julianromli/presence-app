# Device QR Registration Design

Date: 2026-03-06  
Project: Absenin.id App  
Scope: Redesign flow `device-qr` dari model role-based auth menjadi public bootstrap dengan device permanen yang dikelola eksklusif oleh `superadmin`.

## 1. Context and Goals

Flow `device-qr` saat ini masih bergantung pada login Clerk dan workspace role `device-qr`. Model ini cukup berat secara operasional karena setiap perangkat QR harus memiliki akun atau membership sendiri, padahal kebutuhan bisnis sebenarnya lebih dekat ke identitas perangkat, bukan identitas user.

Tujuan redesign:
- Menghapus kebutuhan login user khusus untuk perangkat QR.
- Membuat onboarding device cukup lewat halaman publik `/device-qr`.
- Menggunakan access code sekali pakai per device yang dibuat `superadmin`.
- Menjadikan device permanen setelah claim sukses sampai direvoke.
- Menjaga audit trail, heartbeat, dan sumber scan tetap aman serta teridentifikasi.

Out of scope:
- Pairing via QR dari dashboard.
- Multi-step approval flow dari device ke admin.
- Recovery device tanpa pairing ulang jika local secret hilang.

## 2. Product Decisions (Validated)

- `/device-qr` menjadi halaman publik untuk bootstrap device.
- Device tidak lagi memakai akun dengan role `device-qr`.
- Satu device baru membutuhkan satu access code sekali pakai.
- Access code dibuat oleh `superadmin`, berlaku 5 menit, dan harus punya log status.
- Flow claim: input code -> validating -> success -> isi nama device -> simpan ke database -> active.
- Setelah claim sukses, device dianggap permanen sampai dicabut `superadmin`.
- Satu workspace boleh memiliki banyak device QR permanen.
- Label device diisi dari perangkat saat proses claim.
- Semua manajemen device QR tetap eksklusif `superadmin`.
- Jika device direvoke, request berikutnya harus langsung menjatuhkan UI kembali ke form input code.

## 3. Recommended Approach

Gunakan model dua entitas terpisah:
- `device_registration_codes` sebagai tiket onboarding sementara.
- `devices` sebagai identitas permanen perangkat.

Access code hanya dipakai untuk bootstrap, bukan identitas operasional. Setelah claim berhasil, device menggunakan `device secret` permanen yang disimpan lokal di browser perangkat dan diverifikasi server pada setiap request QR token atau heartbeat.

Pendekatan ini dipilih karena:
- Tetap sederhana bagi user lapangan.
- Lebih aman dibanding menyimpan identitas device hanya di local storage tanpa secret server-side.
- Lebih tepat secara domain karena sumber scan adalah perangkat, bukan akun user.
- Memungkinkan revoke, rename, audit, dan monitoring heartbeat per device.

## 4. High-Level Architecture

### 4.1 Public Bootstrap Layer

Halaman `/device-qr` dibuka tanpa login. Halaman ini hanya menangani:
- Validasi access code.
- Input label device.
- Penyimpanan local device secret setelah claim berhasil.

Halaman publik ini tidak memberi kemampuan administratif apa pun.

### 4.2 Registration Code Layer

`superadmin` membuat access code sekali pakai dari dashboard. Setiap code:
- Terikat ke satu workspace.
- Berlaku 5 menit.
- Hanya dapat diklaim satu kali.
- Disimpan sebagai hash, bukan plaintext.
- Memiliki status efektif `pending`, `claimed`, `expired`, atau `revoked`.

### 4.3 Registered Device Layer

Setelah code berhasil diklaim, sistem membuat row `device` permanen yang menyimpan:
- `workspaceId`
- `label`
- `deviceSecretHash`
- `status` (`active` atau `revoked`)
- `claimedAt`
- `lastSeenAt`
- metadata audit seperlunya seperti IP awal atau user-agent saat claim

Semua request operasional device sesudah itu memakai secret device, bukan Clerk session.

## 5. Data Model Changes

### 5.1 New Table: `device_registration_codes`

Field yang direkomendasikan:
- `workspaceId`
- `codeHash`
- `createdByUserId`
- `createdAt`
- `expiresAt`
- `claimedAt`
- `claimedByDeviceId`
- `revokedAt`

Derived status:
- `pending`: belum claimed, belum expired, belum revoked.
- `claimed`: sudah dipakai untuk membuat device.
- `expired`: melewati `expiresAt` dan belum claimed.
- `revoked`: dibatalkan sebelum dipakai.

### 5.2 New Table: `devices`

Field yang direkomendasikan:
- `workspaceId`
- `label`
- `deviceSecretHash`
- `status`
- `claimedFromCodeId`
- `claimedAt`
- `createdAt`
- `updatedAt`
- `lastSeenAt`
- `revokedAt`
- `revokedByUserId`
- `initialIpAddress`
- `initialUserAgent`

### 5.3 Existing Table Refactors

Ubah referensi operasional dari `deviceUserId` ke `deviceId` pada area berikut:
- `qr_tokens`
- `device_heartbeats`
- metadata sumber scan attendance

Dengan perubahan ini, sumber scan menjadi benar-benar merepresentasikan perangkat QR yang terdaftar.

## 6. User Flow and Runtime States

### 6.1 Device Page States

`/device-qr` memiliki tiga state utama:
- `enter-code`
- `name-device`
- `active-device`

Saat halaman dibuka:
- Jika browser tidak punya local device secret, tampil `enter-code`.
- Jika browser punya local device secret, client mencoba autentikasi device.
- Jika autentikasi valid, masuk ke `active-device`.
- Jika secret invalid atau revoked, client hapus local secret dan kembali ke `enter-code` pada request itu juga.

### 6.2 Claim Flow

Langkah claim:
1. Device input access code.
2. Server validasi code: cocok, belum claimed, belum expired, belum revoked.
3. Jika valid, UI pindah ke form nama device.
4. User input label device.
5. Server menjalankan claim atomik:
   - membuat row `device`
   - menghasilkan `device secret` acak
   - menyimpan hash secret
   - menandai code sebagai `claimed`
   - mengembalikan plaintext secret sekali saja
6. Browser menyimpan secret lokal dan masuk ke `active-device`.

### 6.3 Active Device Flow

Sesudah aktif, device:
- mengambil QR token rotasi memakai autentikasi device secret
- mengirim heartbeat periodik
- menerima penolakan otomatis jika device sudah direvoke

Jika request operasional gagal karena device sudah tidak valid, UI langsung reset ke state input code.

## 7. Security Model

Prinsip keamanan utama:
- Access code dan device secret disimpan sebagai hash.
- Device secret plaintext hanya dikirim sekali saat claim sukses.
- Error dibuat generik agar tidak membocorkan terlalu banyak informasi tentang validity code.
- Code bersifat sekali pakai dan hanya berlaku 5 menit.
- Device permanen dapat direvoke kapan saja oleh `superadmin`.
- Secret yang hilang tidak bisa dipulihkan; device harus pair ulang dengan code baru.

Hardening yang direkomendasikan:
- Throttling ringan per IP atau per percobaan claim.
- Audit log pada generate code, claim sukses, revoke, dan rename.
- Optional cleanup job untuk code expired dan data pairing lama yang tidak relevan.

## 8. Dashboard Superadmin

Tambahkan modul manajemen device QR khusus `superadmin` dengan dua area:

### 8.1 Devices

Daftar device permanen per workspace berisi:
- label device
- status `active/revoked`
- status online/offline dari heartbeat
- `lastSeenAt`
- `claimedAt`
- aksi `rename`
- aksi `revoke`

### 8.2 Registration Codes

Daftar code onboarding berisi:
- status `pending/claimed/expired/revoked`
- waktu dibuat
- waktu expired
- siapa pembuat code
- device hasil claim jika sudah dipakai

Dashboard generate code tidak perlu meminta nama device di awal karena label diisi dari device saat claim.

## 9. Authorization Boundaries

Boundary akses yang tervalidasi:
- Publik: hanya validasi code, claim device, dan request device-authenticated memakai secret yang valid.
- `superadmin`: generate code, melihat daftar device, rename device, revoke device, dan melihat log registration code.
- `admin` biasa tidak memiliki akses manajemen device QR.

Ini menjaga pemisahan yang tegas antara operasional device dan kontrol administratif.

## 10. Migration Strategy

Rollout yang direkomendasikan adalah bertahap:

Phase 1:
- Tambahkan tabel dan endpoint baru untuk registration code dan registered device.
- Pertahankan flow lama berbasis role `device-qr` sementara.

Phase 2:
- Alihkan `/device-qr` ke flow publik baru.
- Ubah issue QR token dan heartbeat agar berbasis `deviceId`.

Phase 3:
- Ubah attendance source metadata agar menggunakan `deviceId`.
- Tambahkan dashboard management untuk `superadmin`.

Phase 4:
- Pair ulang device lama ke model baru.
- Setelah operasional stabil, bersihkan role `device-qr` dari lifecycle yang tidak lagi dibutuhkan.

Pendekatan bertahap ini menurunkan risiko downtime operasional saat migrasi.

## 11. Testing Strategy

Test yang wajib:
- Generate access code sukses untuk `superadmin`.
- Access code expired ditolak.
- Access code yang sudah claimed tidak bisa dipakai lagi.
- Claim sukses menyimpan label device dan membuat device permanen.
- Device secret valid bisa mengambil QR token dan mengirim heartbeat.
- Device yang direvoke langsung gagal pada request berikutnya dan UI kembali ke form code.
- Rename hanya bisa dilakukan `superadmin`.
- Attendance tetap menolak scan dari device invalid atau heartbeat stale saat enforcement aktif.

## 12. Open Implementation Notes

Keputusan implementasi yang dipakai:
- Local secret disimpan di `localStorage` dengan key `absenin.id.deviceSession`.
- Header autentikasi device memakai `x-device-key` dengan format `<deviceId>.<secret>`.
- Endpoint publik tetap terikat ke workspace lewat header `x-workspace-id`.
- Cleanup expired registration code dijalankan berkala lewat cron `cleanup_expired_device_registration_codes`.

Urutan migrasi yang diterapkan:
1. Tambah tabel `device_registration_codes` dan `devices`, plus helper hashing/session device.
2. Tambah bootstrap endpoint publik dan restore auth device tanpa Clerk.
3. Alihkan issue QR token dan heartbeat ke `deviceId`.
4. Alihkan sumber scan attendance dan metadata ke `deviceId`.
5. Tambah API dan UI manajemen device untuk `superadmin`.

Catatan rollback:
- Role legacy `device-qr` tetap dipertahankan di schema agar rollback operasional masih memungkinkan.
- Jika bootstrap publik perlu dimatikan, route runtime baru dapat dinonaktifkan tanpa menghapus tabel device permanen lebih dulu.
