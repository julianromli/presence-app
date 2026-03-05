# Presence App

Presence adalah aplikasi absensi digital berbasis Next.js + Clerk + Convex dengan alur:
- QR dinamis untuk akun `device-qr` (rotasi 5 detik, valid 20 detik, single-use token).
- Scan oleh `karyawan` dengan guardrail keamanan (replay protection, anti-spam, geofence/IP whitelist opsional).
- Dashboard admin/superadmin untuk attendance, scan events, users, device heartbeat, dan report mingguan.

## Stack
- Next.js `16.1.6` (App Router)
- React `19.2.3`
- Clerk (`@clerk/nextjs`)
- Convex (`convex`)
- Vitest + ESLint

## Prerequisites
- Node.js **20 LTS** (baseline lokal dan CI)
- npm `>=10`
- Convex deployment aktif
- Clerk project aktif

Gunakan `.nvmrc`:
```bash
nvm use
```

## Environment Variables
Salin `.env.example` ke `.env.local`, lalu isi:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Convex
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOYMENT=

# Security
QR_TOKEN_SECRET=

# Optional UploadThing
UPLOADTHING_TOKEN=
```

## Local Setup
```bash
npm ci
npm run dev
```

App default: [http://localhost:3000](http://localhost:3000)

## Scripts
- `npm run dev` - start dev server
- `npm run build` - production build check
- `npm run start` - run production server
- `npm run lint` - lint checks
- `npm test` - run Vitest once
- `npm run test:watch` - Vitest watch mode

## Auth & Role Matrix
- `superadmin`: full access termasuk settings geofence/IP, role management.
- `admin`: dashboard operasional dan manajemen non-privileged users.
- `karyawan`: scan attendance.
- `device-qr`: generate QR token + heartbeat device.

## API Surface (Ringkas)
- Public: `GET /api/health`
- Device:
  - `GET /api/device/qr-token`
  - `POST /api/device/ping`
- Attendance:
  - `POST /api/scan`
  - `GET /api/admin/attendance`
  - `PATCH /api/admin/attendance/edit`
  - `GET /api/admin/attendance/scan-events`
  - `GET /api/admin/attendance/summary`
- Admin:
  - `GET|PATCH /api/admin/settings`
  - `GET|POST /api/admin/reports`
  - `GET /api/admin/reports/download`
  - `GET|PATCH /api/admin/users`

Semua non-2xx response menggunakan bentuk:
```json
{ "code": "ERROR_CODE", "message": "Human readable message" }
```

## Quality Gate
CI workflow ada di `.github/workflows/ci.yml`:
1. `npm ci`
2. `npm run lint`
3. `npm test`
4. `npm run build`

## Next.js Docs Bootstrap (Repo Policy)
Jika `.next-docs/` belum ada, generate docs index lokal:
```bash
npx @next/codemod agents-md --output AGENTS.md
```

## Operational Notes
- Auth boundary file untuk Next.js 16: `proxy.ts`.
- Device heartbeat enforcement bisa diaktifkan dari settings (`enforceDeviceHeartbeat`).
- Report mingguan jalan via Convex cron (`weekly_presence_report`).
