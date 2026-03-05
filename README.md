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
- Bun `1.3.x` (default package manager + command runner)
- Node.js `>=20.9` (runtime requirement Next.js, termasuk runtime production di Vercel)
- Convex deployment aktif
- Clerk project aktif

Pin versi Bun via `.bun-version`:
```bash
bun --version
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
bun install --frozen-lockfile
bun run dev
```

App default: [http://localhost:3000](http://localhost:3000)

## Scripts
- `bun run dev` - start dev server
- `bun run build` - production build check
- `bun run start` - run production server
- `bun run lint` - lint checks
- `bun run test` - run Vitest once
- `bun run test:watch` - Vitest watch mode

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
1. `bun install --frozen-lockfile`
2. `bun run lint`
3. `bun run test`
4. `bun run build`

## Package Manager & Runtime Policy
- Default local development, install dependency, test, lint, dan build: **Bun**.
- Deployment target: **Vercel (managed)**.
- Runtime production server/function tetap **Node.js** (constraint platform), bukan Bun runtime.
- Vercel build/install command dikunci lewat `vercel.json`:
  - `installCommand`: `bun install --frozen-lockfile`
  - `buildCommand`: `bun run build`

## Next.js Docs Bootstrap (Repo Policy)
Jika `.next-docs/` belum ada, generate docs index lokal:
```bash
npx @next/codemod agents-md --output AGENTS.md
```

## Operational Notes
- Auth boundary file untuk Next.js 16: `proxy.ts`.
- Device heartbeat enforcement bisa diaktifkan dari settings (`enforceDeviceHeartbeat`).
- Report mingguan jalan via Convex cron (`weekly_presence_report`).
