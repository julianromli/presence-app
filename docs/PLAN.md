# Delivery Plan - Hardening & Reliability

Tanggal update: **March 5, 2026**

## Tujuan
Selesaikan satu batch hardening yang mencakup correctness, security, runtime compatibility, CI, dan dokumentasi.

## Scope yang Diimplementasikan

1. Attendance filter-first pagination untuk `q` + summary mengikuti dataset terfilter.
2. Enforcement `enforceDeviceHeartbeat` pada alur scan.
3. Migrasi `middleware.ts` -> `proxy.ts` (Next.js 16 convention).
4. Standarisasi non-2xx response ke `{ code, message }`.
5. Kebijakan QR hybrid (rotasi 5 detik, valid 20 detik) dikunci di code path.
6. Workflow CI lint/test/build (GitHub Actions, Node 20).
7. Repo hygiene (`.clerk/`, `cloudflared.log`, ignore lint untuk `convex/_generated`).
8. Refresh dokumentasi utama.
9. Baseline environment lokal via `.nvmrc` Node 20.

## Validation Gate

- `npm run lint`
- `npm test`
- `npm run build`

## Outcome Tracking

- Jika seluruh gate lulus: status batch = **DONE**.
- Jika ada gate gagal: status batch = **PARTIAL**, rollback tidak otomatis, lakukan fix-forward.

## Tindak Lanjut Non-Code

- Set workflow `CI` sebagai required check di branch protection.
- Putuskan target SLA/alerting produksi.
