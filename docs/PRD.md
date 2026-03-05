# PRD - Presence (Absensi Digital)

Tanggal dokumen: **March 5, 2026**  
Status: **Aktif (post-MVP hardening pass)**

## 1. Ringkasan Produk

Presence adalah sistem absensi digital untuk kantor dengan fokus:
- alur scan cepat untuk `karyawan`,
- kontrol kebijakan ketat oleh `superadmin`,
- observabilitas operasional untuk `admin`.

Tujuan bisnis:
- menekan fraud attendance,
- mempercepat rekap operasional,
- menyediakan jejak audit untuk perubahan data.

## 2. Ruang Lingkup Fungsional Saat Ini

### Role & akses
- `superadmin`: konfigurasi keamanan, role management, seluruh dashboard.
- `admin`: monitoring operasional dan manajemen user non-privileged.
- `karyawan`: scan attendance.
- `device-qr`: menampilkan QR dinamis + heartbeat.

### Attendance & Security Policy
- QR token dinamis dengan kebijakan **hybrid**:
  - rotasi token: **setiap 5 detik**
  - masa berlaku token: **20 detik**
  - token: **single-use** (anti replay)
- Guardrail scan:
  - role check server-side,
  - anti-spam cooldown,
  - geofence (opsional),
  - IP whitelist (opsional),
  - optional device heartbeat enforcement (`enforceDeviceHeartbeat`).
- Jika heartbeat enforcement aktif:
  - scan ditolak saat device heartbeat tidak ada/stale (>60 detik).

### Dashboard & Reporting
- Dashboard attendance harian (pagination + filter + summary).
- Scan events + reason breakdown.
- Status heartbeat device-qr.
- Report mingguan `.xlsx` via Convex cron.

## 3. Kriteria Keberhasilan Operasional

- Scan valid tersimpan tanpa error sistem kritikal.
- Tidak ada bypass RBAC pada endpoint sensitif.
- Semua non-2xx API response mengikuti kontrak `{ code, message }`.
- Cron report mingguan menghasilkan status jelas (`pending/success/failed`).
- Perubahan data sensitif tercatat di audit log.

## 4. Non-Goals (Masih di luar scope)

- Payroll dan perhitungan gaji.
- Integrasi HRIS pihak ketiga.
- Face recognition / selfie verification.
- Multi-cabang dengan policy shift kompleks.

## 5. Open Items (per March 5, 2026)

- Menetapkan rule required status untuk workflow CI di repository settings.
- Menambahkan coverage untuk integration test route-level end-to-end.
- Menetapkan SLA alerting produksi (error rate scan, cron failure beruntun, device offline).
