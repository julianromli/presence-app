# QA Security Smoke Checklist

Tanggal acuan: **March 5, 2026**

## Prasyarat
- App jalan lokal (`npm run dev`)
- Role tersedia: `superadmin`, `admin`, `karyawan`, `device-qr`
- Data settings global sudah ada

## Matrix Endpoint Inti

| Endpoint | Unauthenticated | Superadmin | Admin | Karyawan | Device-QR |
|---|---:|---:|---:|---:|---:|
| `GET /api/device/qr-token` | 401 | 403 | 403 | 403 | 200 |
| `POST /api/device/ping` | 401 | 403 | 403 | 403 | 200 |
| `POST /api/scan` | 401 | 403 | 403 | 200* | 403 |
| `GET /api/admin/settings` | 401 | 200 | 403 | 403 | 403 |
| `PATCH /api/admin/settings` | 401 | 200 | 403 | 403 | 403 |

`*` untuk payload valid + token valid + policy lolos.

## Skenario Wajib

1. **QR Hybrid Policy**
- Token QR refresh sekitar setiap 5 detik.
- Token masih valid hingga 20 detik sejak issue.
- Token replay harus ditolak (`TOKEN_REPLAY`).

2. **Role Guard**
- `device-qr` bisa `GET /api/device/qr-token`.
- role selain `device-qr` harus `403`.
- `karyawan` saja yang bisa scan.

3. **Validation & Error Contract**
- Payload scan tanpa token -> `400` + `{ code, message }`.
- Semua non-2xx response dari endpoint admin/device/scan harus punya `code` dan `message`.

4. **Heartbeat Enforcement**
- Set `enforceDeviceHeartbeat=false`: scan normal.
- Set `enforceDeviceHeartbeat=true`:
  - device heartbeat fresh: scan diterima.
  - device heartbeat stale/tidak ada: reject `DEVICE_HEARTBEAT_STALE`.

5. **Policy Reject**
- Token expired -> `TOKEN_EXPIRED`.
- Spam scan dalam cooldown -> `SPAM_DETECTED`.
- Geofence/IP reject sesuai policy aktif.

## Kriteria Lulus
- Tidak ada bypass RBAC.
- Semua reject utama menghasilkan `code` yang benar.
- Tidak ada error 500 pada skenario invalid yang seharusnya tertangani.
