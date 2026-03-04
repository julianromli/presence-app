# QA Security Smoke Checklist

Tanggal acuan: 4 Maret 2026  
Tujuan: verifikasi cepat auth/RBAC dan guardrail scan sebelum rilis.

## Prasyarat
- App jalan di lokal (`npm run dev`).
- Akun role tersedia: `superadmin`, `admin`, `karyawan`, `device-qr`.
- Endpoint diuji lewat browser app atau API client.

## Matrix Endpoint dan Ekspektasi

| Endpoint | Unauthenticated | Superadmin | Admin | Karyawan | Device-QR |
|---|---:|---:|---:|---:|---:|
| `GET /api/device/qr-token` | `401` | `403` | `403` | `403` | `200` |
| `POST /api/scan` | `401` | `403` | `403` | `200`* | `403` |
| `GET /api/admin/settings` | `401` | `200` | `403` | `403` | `403` |
| `PATCH /api/admin/settings` | `401` | `200` | `403` | `403` | `403` |

`*` untuk payload valid + token valid.

## Checklist Wajib

1. Validasi role guard `device-qr`:
- Login sebagai `device-qr`.
- `GET /api/device/qr-token` harus `200` dan payload token keluar.
- Login selain `device-qr` harus `403`.

2. Validasi role guard scan:
- Login sebagai `karyawan`, kirim `POST /api/scan` dengan payload valid harus `200`.
- Login role lain kirim request yang sama harus `403`.

3. Validasi payload error scan:
- Sebagai `karyawan`, kirim payload tanpa `token`.
- Ekspektasi `400` dengan `code: VALIDATION_ERROR`.

4. Token expiry:
- Gunakan token QR yang sudah lewat TTL.
- Ekspektasi reject dengan `code: TOKEN_EXPIRED`.

5. Replay token:
- Pakai token yang sama dua kali.
- Request kedua harus reject dengan `code: TOKEN_REPLAY`.

6. Anti-spam:
- Lakukan scan berturut-turut dalam window 30 detik.
- Ekspektasi reject dengan `code: SPAM_DETECTED`.

7. Settings superadmin-only:
- `GET` dan `PATCH /api/admin/settings` sukses hanya untuk `superadmin`.
- Role lain harus `403`.

## Catatan Lulus
- Tidak ada bypass role pada endpoint sensitif.
- Semua reject reason utama (`TOKEN_EXPIRED`, `TOKEN_REPLAY`, `SPAM_DETECTED`) muncul sesuai skenario.
- Tidak ada error 500 untuk skenario invalid yang harusnya ditangani.
