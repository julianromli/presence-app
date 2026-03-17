# Workspace Subscription Plan Design

Date: 2026-03-17  
Project: Absenin.id App  
Scope: Menetapkan fondasi plan, entitlement, dan monetization awal berbasis workspace subscription untuk model `free`, `pro`, dan `enterprise`.

## 1. Context and Goal

Absenin.id sudah berjalan dengan model multi-workspace di Convex. Langkah berikutnya adalah menambahkan fondasi monetization yang sederhana, konsisten, dan mudah diubah tanpa perlu merombak banyak bagian codebase saat aturan plan berubah.

Target desain ini:
- Menetapkan subscription menempel ke `workspace`, bukan ke user Clerk.
- Menetapkan paket v1 `free`, `pro`, dan `enterprise`.
- Menetapkan pola entitlement yang mudah diubah dari satu tempat.
- Menetapkan titik enforcement limit dan feature gating di flow yang sudah ada.
- Menjaga desain tetap sederhana untuk implementasi awal, tetapi siap untuk billing yang lebih matang nanti.

Out of scope:
- Integrasi payment provider.
- Invoice, trial automation, coupon, dan lifecycle billing lengkap.
- Override plan per workspace.
- Admin UI internal untuk mengubah plan catalog tanpa deploy.

## 2. Validated Product Decisions

Keputusan yang sudah tervalidasi:
- Subscription model menggunakan `workspace subscription`.
- `workspace.plan` disimpan di database.
- Definisi global plan disimpan di code dalam `central plan catalog`.
- Entitlement dibedakan dengan pola hybrid:
  - numeric limits
  - feature flags
- Paket v1:
  - `free`
  - `pro`
  - `enterprise`
- Angka limit v1 yang dikunci:
  - `free`: 5 member
  - `pro`: 50 member
  - `enterprise`: custom
- `inviteRotation` tetap dibuka untuk `free`.
- Rule plan hanya berlaku global per plan, bukan override per workspace tertentu.

## 3. Why Workspace Subscription

Model ini dipilih karena limit utama produk saat ini bersifat workspace-scoped:
- jumlah user di dalam workspace
- jumlah device di dalam workspace
- fitur operasional workspace seperti geofence, IP whitelist, attendance schedule, dan export report

Jika plan diletakkan di user Clerk:
- ownership subscription menjadi rancu saat satu workspace memiliki lebih dari satu admin
- membership user lintas workspace menjadi sulit dimodelkan
- limit `jumlah user di dalam workspace` tidak natural karena itu adalah properti workspace, bukan properti user

Dengan `workspace subscription`:
- tiap workspace memiliki plan sendiri
- satu user dapat menjadi anggota beberapa workspace dengan plan berbeda
- enforcement server-side menjadi lebih langsung karena semua batas ada di domain workspace

## 4. Source of Truth and Data Ownership

Desain source of truth dibagi menjadi dua:

### 4.1 Database: runtime subscription state

Database menyimpan state plan yang dipakai runtime:
- `workspace.plan`

Future-ready fields yang boleh disiapkan dari awal bila ingin, tetapi tidak wajib untuk implementasi v1:
- `subscriptionStatus`
- `trialEndsAt`
- `currentPeriodEndsAt`

Rekomendasi v1:
- implement minimum dulu dengan `plan`
- field lifecycle subscription bisa ditambahkan saat integrasi billing mulai nyata

### 4.2 Code: global plan definition

Code menyimpan definisi plan global dalam `central plan catalog`.

Catalog ini menjadi tempat tunggal untuk:
- limit angka
- fitur yang dibuka atau ditutup
- perubahan positioning plan di masa depan

Konsekuensi penting:
- aplikasi tidak boleh menyebar pengecekan `workspace.plan === "pro"` di banyak tempat
- semua capability harus di-resolve lewat satu lapisan entitlement

## 5. Verification Notes from Docs

Keputusan di atas diverifikasi pada 2026-03-17 menggunakan dokumentasi resmi Clerk dan Convex.

Ringkasan temuan:
- Clerk metadata cocok untuk atribut user-level ringan, tetapi bukan kandidat terbaik untuk source of truth subscription workspace.
- `public metadata` dapat diakses frontend.
- total metadata Clerk pada user dibatasi, dan Clerk juga mengingatkan agar custom session claims tetap kecil.
- perubahan metadata tidak selalu langsung tercermin pada token tanpa refresh, sehingga kurang ideal untuk enforcement operasional yang sensitif.
- Convex lebih cocok untuk menyimpan application state yang tervalidasi dan workspace-scoped lewat tabel berschema.

Referensi:
- https://clerk.com/docs/guides/users/extending
- https://clerk.com/docs/guides/secure/basic-rbac
- https://docs.convex.dev/database/schemas
- https://docs.convex.dev/database
- https://docs.convex.dev/database/reading-data/indexes/

## 6. Recommended Architecture

Arsitektur yang direkomendasikan:

1. `workspaces` menyimpan plan aktif workspace
2. satu modul code menyimpan `PLAN_CATALOG`
3. satu resolver entitlement mengubah `workspace.plan` menjadi capability yang seragam
4. semua server action dan UI membaca capability hasil resolver, bukan nama plan mentah

Pendekatan ini dipilih karena:
- mudah diubah saat pricing berubah
- minim titik edit saat fitur dibuka untuk semua workspace dalam satu plan
- type-safe
- enforcement lebih mudah diuji

## 7. Data Model Recommendation

### 7.1 Workspace field

Tambahkan field berikut pada `workspaces`:
- `plan: "free" | "pro" | "enterprise"`

Default v1:
- workspace baru dibuat dengan `plan: "free"`

### 7.2 Central plan catalog

Modul pusat, misalnya:
- `lib/billing/plan-catalog.ts`

Isi modul:
- type plan
- definisi limits
- definisi feature flags
- helper pembacaan plan

### 7.3 Entitlement resolver

Modul resolver, misalnya:
- `lib/billing/entitlements.ts`

Tanggung jawab:
- menerima `workspace.plan`
- mengembalikan capability final yang seragam

Contoh bentuk hasil resolver:
- `limits.maxOwnedWorkspaces`
- `limits.maxMembersPerWorkspace`
- `limits.maxDevicesPerWorkspace`
- `features.geofence`
- `features.ipWhitelist`
- `features.attendanceSchedule`
- `features.reportExport`
- `features.inviteRotation`
- `features.inviteExpiry`

## 8. Locked Package Design v1

## 8.1 Free

Plan `free` ditujukan untuk tim kecil yang sedang mencoba produk.

Limits:
- `maxOwnedWorkspaces: 1`
- `maxMembersPerWorkspace: 5`
- `maxDevicesPerWorkspace: 1`

Features enabled:
- attendance dasar
- dashboard dasar
- invite code basic
- `inviteRotation`

Features disabled:
- `geofence`
- `ipWhitelist`
- `attendanceSchedule`
- `reportExport`
- `inviteExpiry`

## 8.2 Pro

Plan `pro` adalah paket utama untuk operasi harian bisnis kecil hingga menengah.

Limits:
- `maxMembersPerWorkspace: 50`
- `maxDevicesPerWorkspace: 3`

Features enabled:
- semua fitur `free`
- `geofence`
- `ipWhitelist`
- `attendanceSchedule`
- `reportExport`
- `inviteRotation`
- `inviteExpiry`

## 8.3 Enterprise

Plan `enterprise` ditujukan untuk kebutuhan sales-assisted dan limit khusus.

Limits:
- `maxMembersPerWorkspace: custom`
- `maxDevicesPerWorkspace: custom`

Features enabled:
- semua fitur `pro`

Catatan:
- v1 tidak perlu menambah banyak feature gate baru khusus enterprise
- fokus utama enterprise v1 adalah custom limits dan jalur upgrade manual

## 9. Entitlement Model

Semua pembacaan plan harus melalui entitlement model, bukan pembacaan plan mentah.

Aturan inti:
- code tidak boleh mengambil keputusan dengan `if plan === "pro"` di banyak tempat
- code harus bertanya ke capability final

Contoh pertanyaan yang benar:
- apakah workspace masih boleh menambah member?
- apakah workspace boleh export report?
- apakah workspace boleh menyimpan geofence?

Contoh pertanyaan yang harus dihindari:
- apakah workspace plan-nya `pro`?

Manfaat utama pola ini:
- jika nanti fitur tertentu dibuka untuk semua `free`, perubahan cukup dilakukan di catalog
- route handler, mutation, dan UI tidak perlu dirombak secara konseptual

## 10. Enforcement Strategy

Enforcement dibagi menjadi dua lapisan:

### 10.1 Server-side hard gate

Ini adalah source of truth utama.

Server wajib memeriksa entitlement saat:
- create workspace
- join workspace atau aktivasi membership kembali
- invite atau penambahan member
- claim atau register device QR
- update settings workspace
- export atau download report
- pengaturan expiry invite

Jika gagal, server mengembalikan error domain yang jelas.

Rekomendasi kode error:
- `PLAN_LIMIT_REACHED`
- `FEATURE_NOT_AVAILABLE`
- `WORKSPACE_PLAN_INVALID`
- `SUBSCRIPTION_INACTIVE` untuk future-ready

### 10.2 UI soft gate

UI dipakai untuk pengalaman pengguna, bukan proteksi utama.

Pola UI yang direkomendasikan:
- tombol disabled saat fitur tidak tersedia
- badge `Pro` pada fitur premium
- empty or blocked state dengan upsell copy sederhana

UI tidak boleh menjadi satu-satunya proteksi.

## 11. Enforcement Points in Current Codebase

Berikut titik enforcement yang paling natural untuk repo saat ini:

### 11.1 Workspace creation

Saat create workspace:
- cek `maxOwnedWorkspaces`
- workspace baru default ke `plan: "free"`

Catatan:
- walaupun subscription menempel ke workspace, batas `owned workspace` tetap relevan sebagai rule entry-level untuk user pembuat

### 11.2 Workspace membership flow

Saat join workspace atau menambah member:
- cek `maxMembersPerWorkspace`
- lakukan check sebelum membership dibuat atau diaktifkan kembali

### 11.3 Device QR flow

Saat claim atau register device:
- cek `maxDevicesPerWorkspace`

### 11.4 Workspace settings

Saat menyimpan pengaturan:
- `geofence`
- `ipWhitelist`
- `attendanceSchedule`

Check dilakukan saat save server-side, bukan hanya saat render UI.

### 11.5 Reports

Saat download atau export report:
- cek `reportExport`

### 11.6 Invite management

Aturan v1:
- `inviteRotation` tersedia di semua plan
- `inviteExpiry` hanya tersedia pada `pro` dan `enterprise`

## 12. Operational Change Policy

Desain ini sengaja dipilih agar perubahan kebijakan plan tidak memicu refactor besar.

Jika nanti developer ingin membuka fitur tertentu untuk semua workspace dalam satu plan:
- ubah satu entry di `PLAN_CATALOG`
- entitlement resolver tetap sama
- titik enforcement tetap sama

Yang tidak perlu dilakukan:
- mengubah banyak route handler satu per satu
- menulis ulang struktur gate di UI
- mengubah schema subscription hanya karena satu fitur dipindah plan

## 13. Rollout Recommendation

Rollout v1 yang direkomendasikan:

1. Tambahkan field `plan` pada `workspaces`
2. Set default workspace baru ke `free`
3. Tambahkan `PLAN_CATALOG`
4. Tambahkan entitlement resolver
5. Terapkan guard server-side pada limit member, device, dan settings premium
6. Terapkan soft gate UI pada area terkait
7. Tambahkan test untuk limit dan feature gate

Urutan ini dipilih agar pondasi entitlement siap dulu sebelum copy upsell dan billing lifecycle ditambahkan.

## 14. Acceptance Criteria

Desain ini dianggap berhasil jika:
- setiap workspace memiliki satu `plan` yang jelas di database
- definisi plan tersentralisasi di code
- tidak ada logic penting yang menyebar dengan cek nama plan mentah di banyak tempat
- limit member dan device ditegakkan server-side
- fitur premium settings dan report export ditegakkan server-side
- perubahan entitlement untuk satu plan cukup dilakukan dari satu tempat

## 15. Next Step

Langkah berikutnya setelah design ini ditinjau user:
- menulis implementation plan berbasis dokumen ini
- memecah pekerjaan ke perubahan schema, helper entitlement, enforcement server-side, UI soft gate, dan testing
