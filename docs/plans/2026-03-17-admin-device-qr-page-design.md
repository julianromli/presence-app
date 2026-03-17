# Admin Device QR Page Design

Date: 2026-03-17  
Project: Absenin.id App  
Scope: Memisahkan UX manajemen `Device QR` dari halaman laporan admin menjadi page khusus dashboard yang hanya bisa diakses `superadmin`.

## 1. Context and Goal

Saat ini alur manajemen `Device QR` untuk admin masih terasa menyatu dengan halaman laporan. Secara domain, halaman laporan berfokus pada attendance, scan event, dan weekly report, sedangkan `Device QR` adalah workflow operasional tersendiri: membuat registration code, memantau device yang terdaftar, mengganti nama device, mencabut device, dan melihat status online perangkat.

Target redesign:
- Membuat satu page khusus `Device QR` untuk operasional device.
- Menghapus total section `Device QR` dari halaman laporan.
- Menjaga akses tetap eksklusif untuk `superadmin`.
- Menempatkan `Device QR` sebagai item sidebar terpisah sejajar dengan `Laporan` dan `Karyawan`.
- Menjaga pengalaman mobile tetap ringkas dengan menaruh `Device QR` di sheet `More`, bukan bottom nav utama.

Out of scope:
- Mengubah flow publik `/device-qr`.
- Mengubah permission agar `admin` biasa bisa mengakses manajemen device.
- Mendesain ulang fitur laporan, attendance, atau users di luar kebutuhan pemisahan ini.

## 2. Validated Product Decisions

- Page admin baru berada di route `/dashboard/device-qr`.
- Halaman ini adalah control center penuh untuk:
  - generate registration code
  - melihat daftar device
  - rename device
  - revoke device
  - memantau status online device
- Section `Device QR` di halaman laporan lama dihapus total, bukan disisakan sebagai ringkasan.
- Akses page tetap `superadmin only`.
- Di desktop, `Device QR` tampil sebagai item sidebar terpisah sejajar dengan `Laporan` dan `Karyawan`.
- Di mobile, bottom nav `superadmin` tetap `Ringkasan`, `Laporan`, `Karyawan`, `More`.
- Menu `Device QR` untuk mobile masuk ke sheet `More`.

## 3. Recommended Approach

Pisahkan fitur ini pada level route dan navigasi, tetapi pertahankan logic operasional yang sudah ada di area device management selama masih relevan. Dengan begitu, kita tidak membangun ulang seluruh fitur dari nol; kita hanya memindahkan konteks UX-nya ke rumah yang tepat.

Pendekatan ini dipilih karena:
- mental model admin menjadi lebih bersih
- halaman laporan kembali fokus pada attendance dan report
- `Device QR` mendapatkan prioritas visual yang sesuai sebagai workflow operasional
- perubahan implementasi lebih aman karena dapat memanfaatkan komponen dan API yang sudah ada

## 4. Information Architecture

### 4.1 Dashboard Navigation

#### Desktop

Untuk `superadmin`, grup operasional sidebar berubah menjadi:
- `Ringkasan`
- `Laporan`
- `Device QR`
- `Karyawan`

`Device QR` harus terlihat sebagai menu peer, bukan submenu atau bagian dari `Pengaturan`.

#### Mobile

Bottom nav `superadmin` tetap:
- `Ringkasan`
- `Laporan`
- `Karyawan`
- `More`

Sheet `More` memuat:
- `Device QR`
- `Workspace`
- `Geofence`
- item akun yang sudah ada

Pendekatan ini menjaga navigasi utama mobile tetap stabil tanpa membuat dock terlalu padat.

### 4.2 Route Ownership

- `/dashboard/report` hanya bertanggung jawab untuk attendance, scan events, dan weekly reports.
- `/dashboard/device-qr` hanya bertanggung jawab untuk operasional device QR.

Dengan batas ini, user tidak perlu lagi berpindah konteks dalam satu page untuk dua domain yang berbeda.

## 5. Page Structure

### 5.1 Desktop Structure

Halaman `/dashboard/device-qr` terdiri dari tiga area utama:

1. Header page
2. Blok `Registration code terbaru`
3. Blok `Daftar device`

Header page menampilkan:
- judul yang jelas
- deskripsi singkat bahwa page ini mengelola device QR permanen di workspace aktif
- aksi utama `Generate code`
- aksi sekunder `Refresh`

Blok `Registration code terbaru` berada dekat bagian atas agar pairing device bisa dimulai secepat mungkin. Blok ini menampilkan code aktif terakhir, waktu expired, dan setup URL bila masih relevan untuk alur bootstrap device.

Blok `Daftar device` menjadi area operasional utama. Di desktop, format tabel tetap cocok karena data dan aksi lebih efisien dibaca dalam format rapat. Informasi minimum per row:
- label device
- status lifecycle
- status online atau offline
- `lastSeenAt`
- `claimedAt`
- aksi `Rename`
- aksi `Revoke`

### 5.2 Mobile Structure

Di mobile, halaman yang sama memakai urutan blok yang lebih vertikal dan mudah disentuh:
- header ringkas
- tombol `Generate code`
- card `Registration code terbaru`
- daftar device berbasis card

Daftar device tidak memakai tabel. Setiap device tampil sebagai card agar informasi dan aksi tetap nyaman disentuh. Isi minimum tiap card:
- nama device
- status `online/offline`
- status `active/revoked`
- `lastSeenAt`
- aksi `Rename`
- aksi `Revoke`

Tujuannya adalah membuat page terasa seperti panel kontrol cepat, bukan desktop table yang diperkecil.

## 6. Runtime States

### 6.1 Loading State

Saat page dibuka atau workspace aktif berganti:
- tampilkan skeleton untuk blok registration code
- tampilkan skeleton untuk daftar device
- hindari spinner penuh yang membuat seluruh halaman terasa kosong

### 6.2 Empty State

Variasi empty state yang perlu dibedakan:
- belum ada registration code
- belum ada device permanen

Copy harus operasional dan membantu user melangkah. Contoh arah pesan:
"Belum ada device QR aktif untuk workspace ini. Mulai dengan membuat registration code lalu pair device pertama."

Pada empty state, tombol `Generate code` tetap harus tersedia.

### 6.3 Active State

Pada kondisi normal:
- admin melihat registration code terbaru bila ada
- admin melihat daftar device yang sudah terdaftar
- status online dibuat lebih menonjol dari metadata lain

`Rename` boleh inline di desktop. Pada mobile, aksi rename dan revoke harus tetap aman disentuh dan tidak membuat layout sempit.

### 6.4 Error State

Error ditampilkan per blok, bukan digabung menjadi satu fallback besar:
- gagal memuat registration code
- gagal memuat daftar device

Dengan pola ini, jika satu endpoint bermasalah, blok lain tetap bisa dipakai.

## 7. Authorization Boundaries

Aturan akses yang tervalidasi:
- `superadmin` dapat melihat menu dan mengakses `/dashboard/device-qr`
- `admin` tidak dapat mengakses page ini
- `karyawan` tidak dapat melihat menu maupun mengakses route

Boundary ini harus konsisten di:
- sidebar desktop
- mobile sheet `More`
- proteksi server page
- API device management yang sudah ada

## 8. Component and Ownership Strategy

Strategi implementasi yang direkomendasikan:
- gunakan `DeviceManagementPanel` yang sudah ada sebagai basis behavior
- pindahkan rendering utamanya ke page baru `/dashboard/device-qr`
- refactor seperlunya agar framing, title, dan layout cocok untuk page mandiri
- hapus integrasi `DeviceManagementPanel` dari `ReportPanel`

Ini memberi dua keuntungan:
- reuse logic generate, refresh, rename, revoke, dan load data
- mengurangi risiko regresi karena tidak menulis ulang seluruh feature surface

## 9. Verification Criteria

Perubahan dianggap berhasil jika:
- `superadmin` melihat item `Device QR` sebagai menu desktop terpisah
- `Device QR` muncul di mobile sheet `More`
- section `Device QR` tidak lagi muncul di `/dashboard/report`
- route `/dashboard/device-qr` hanya bisa diakses `superadmin`
- aksi `generate code`, `rename`, `revoke`, dan monitoring status online tetap berfungsi
- mobile view tetap nyaman dipakai tanpa tabel horizontal

## 10. Implementation Notes

Catatan implementasi yang perlu dijaga:
- jangan ubah flow publik `/device-qr`
- jangan perluas akses ke `admin`
- jangan sisakan ringkasan `Device QR` di page laporan
- pertahankan pembagian tanggung jawab route agar halaman laporan tetap fokus

## 11. Next Step

Langkah berikutnya setelah design ini disetujui adalah membuat implementation plan yang memecah pekerjaan ke:
- route dan proteksi page baru
- update navigation config desktop dan mobile
- pemindahan panel device management
- pembersihan `ReportPanel`
- verifikasi desktop dan mobile
