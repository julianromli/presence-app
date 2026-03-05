# Backlog 2 Hari (Post-Hardening)

Tanggal backlog: **March 5, 2026**  
Target window: **March 6-7, 2026**

## Prioritas P0

1. Jadikan workflow `CI` sebagai required check di branch utama.
2. Tambahkan integration test API untuk:
   - `/api/admin/attendance` (filter + pagination + summary),
   - `/api/scan` ketika heartbeat enforcement aktif.
3. Tambahkan runbook incident untuk:
   - device heartbeat stale,
   - weekly report gagal,
   - lonjakan reject scan.

## Prioritas P1

1. Tambahkan dashboard widget untuk trend heartbeat device per jam.
2. Tambahkan API rate-limit metrics untuk endpoint scan.
3. Tambahkan export audit log terfilter (tanggal/aktor/action).

## Exit Criteria

- P0 selesai dan diverifikasi.
- Tidak ada regresi di `lint/test/build`.
- Dokumentasi runbook dapat dipakai operator tanpa konteks tambahan.
