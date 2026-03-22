# AGENTS.md

Guidance for coding agents working in `Absenin.id App`.

## Repo Overview

- Stack: Next.js 16 App Router, React 19, Clerk, Convex, Tailwind 4, Vitest, ESLint.
- Package manager and task runner: Bun.
- Production platform: Vercel.
- Production runtime requirement is still Node.js, not Bun runtime.
- Main business domains: auth, workspace-scoped admin flows, QR attendance scan, security guardrails.

## Rule Sources

- This repo currently has no root `AGENTS.md` other than this file.
- No Cursor rules were found in `.cursor/rules/`.
- No root `.cursorrules` file was found.
- No Copilot instructions file was found at `.github/copilot-instructions.md`.
- Guidance here is synthesized from `package.json`, `README.md`, `.github/workflows/ci.yml`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `vercel.json`, and representative app/lib/convex/tests files.

## Toolchain And Runtime

- Bun version is pinned to `1.3.3` in `.bun-version` and `package.json`.
- Node.js must satisfy `>=20.9`.
- Use Bun by default for install, dev, lint, test, and build.
- Do not default to npm or pnpm commands unless the user explicitly asks.
- Deployment behavior must follow `vercel.json`, not assumptions from generic Next.js setups.

## Install And Local Development

- Install dependencies: `bun install --frozen-lockfile`
- Start dev server: `bun run dev`
- Use webpack fallback only if turbopack-specific behavior needs checking: `bun run dev:webpack`
- Run production server locally after a build: `bun run start`
- If local auth or Convex behavior looks broken, check `.env.local` against `.env.example` and `README.md`.

## Build, Lint, And Test Commands

- Build: `bun run build`
- Lint: `bun run lint`
- Run all tests once: `bun run test`
- Watch tests: `bun run test:watch`
- CI quality gate is the source of truth:
  1. `bun install --frozen-lockfile`
  2. `bun run lint`
  3. `bun run test`
  4. `bun run build`
- Before claiming work is complete, aim to match the CI sequence unless the task is explicitly docs-only.

## Running A Single Test

- Preferred single-file pattern: `bun run test -- tests/<file>.test.ts`
- Multiple files: `bun run test -- tests/a.test.ts tests/b.test.ts`
- Single named test in a file: `bun run test -- tests/<file>.test.ts -t "<test name>"`
- Example single file: `bun run test -- tests/scan-guardrails.test.ts`
- Example named test: `bun run test -- tests/scan-guardrails.test.ts -t "rejects payload without token"`
- Vitest is configured in `vitest.config.ts` with `environment: "node"` and the `@` alias.

## Project Structure

- `app/`: Next.js App Router pages, layouts, route handlers.
- `app/api/`: HTTP API endpoints.
- `components/`: feature components.
- `components/ui/`: shared UI primitives and wrappers.
- `lib/`: shared app logic, auth helpers, API helpers, utilities.
- `convex/`: backend queries, mutations, schema-adjacent business logic.
- `tests/`: Vitest test files, usually feature-oriented and flat.
- `types/`: shared TypeScript types.
- `proxy.ts`: auth boundary and route protection for Next.js 16.

## Architecture Rules

- Keep Next.js route handlers thin.
- Route handlers should validate request shape, auth, and workspace context, then delegate business rules to Convex or shared domain helpers.
- Treat Convex as the source of truth for durable invariants and policy enforcement.
- Do not rely on client-side checks alone for RBAC, workspace restrictions, geofence rules, or attendance security behavior.
- Reuse existing helpers before introducing new auth, workspace, or error abstractions.

## Next.js Conventions

- Follow App Router conventions: `page.tsx`, `layout.tsx`, `route.ts`, `not-found.tsx`.
- Server components are the default.
- Add `"use client"` only when a component needs hooks, browser-only APIs, event handlers, or local interactive state.
- Keep browser-only code inside client components.
- `proxy.ts` controls public vs protected routes; update it when changing auth boundaries.
- Preserve existing metadata patterns in layouts and pages.

## Convex Conventions

- Put durable policy checks in Convex mutations and queries.
- Match the surrounding file language: many Convex files are JavaScript, while app/lib/tests are mostly TypeScript.
- Do not hand-edit generated files under `convex/_generated/**`.
- Prefer extending shared helpers and validators over duplicating policy logic.
- Preserve existing security-sensitive error codes and behavior in attendance and scan flows.

## Auth And Workspace Rules

- Canonical auth helpers live in `lib/auth.ts`.
- Protected workspace APIs commonly require `x-workspace-id`.
- Validate workspace headers and membership through existing helpers instead of open-coding checks.
- Keep role strings exact: `superadmin`, `admin`, `karyawan`, `device-qr`.
- Do not create parallel role systems or rename roles casually.
- Public route exceptions should be added in `proxy.ts` only when intentionally public.

## API And Error Handling

- Non-2xx API responses must use `{ code, message }`.
- Prefer `Response.json(...)` for route responses.
- Prefer shared helpers like `convexErrorResponse(...)` for backend failure mapping.
- Preserve existing HTTP status semantics for auth, validation, and policy errors.
- Avoid leaking raw internal errors to clients.
- When changing protected flows, preserve response contracts already asserted in tests.

## TypeScript And Imports

- TypeScript is strict; keep new TS code compatible with `strict: true`.
- The repo uses the `@/*` alias defined in `tsconfig.json`.
- Prefer `@/` imports for internal modules unless a same-folder relative import is simpler.
- Use type-only imports when they improve clarity and match local style.
- Prefer existing shared types before introducing duplicate inline object shapes.
- `satisfies` is used in parts of the repo to lock object shapes; keep using it where helpful.

## Naming And File Conventions

- Use kebab-case for new file names.
- Use PascalCase for React component names.
- Use camelCase for helpers, utilities, and local variables.
- Keep route and layout file names aligned with Next.js conventions.
- Follow the existing feature grouping instead of scattering related logic across unrelated folders.

## Formatting And Editing Rules

- ESLint is the only authoritative repo-wide style gate.
- ESLint config comes from `eslint.config.mjs` with Next core-web-vitals and TypeScript presets.
- Prettier is installed, but there is no authoritative repo format script or config.
- Formatting is mixed across files; preserve surrounding quote style and local formatting instead of doing broad style rewrites.
- Make focused edits; avoid opportunistic reformatting in unrelated code.
- Respect ignored/generated paths such as `.next/**`, `out/**`, `build/**`, `convex/_generated/**`, and `template/**`.

## Testing Conventions

- Test runner: Vitest.
- Tests run in a Node environment.
- Existing tests often use `vi.mock(...)`, `vi.doMock(...)`, and module resets to isolate behavior.
- Prefer behavior-focused tests over implementation-detail assertions.
- For routes and API helpers, assert exact status codes and exact `{ code, message }` payloads when relevant.
- Keep security and RBAC tests precise; those contracts matter.

## Security-Sensitive Areas

- Attendance scan flow is fail-closed by design.
- Preserve QR token expiry, replay protection, spam/cooldown logic, device heartbeat enforcement, geofence checks, and IP policy behavior.
- Be careful when changing request IP handling, workspace enforcement, or Clerk/Convex token flow.
- If you modify scan or auth behavior, run the most relevant focused tests first, then the broader suite.

## Environment And Secrets

- Do not hardcode secrets or copy live credentials into source files.
- Use `.env.local` for local configuration.
- Relevant env vars are documented in `README.md`.
- If a task depends on Clerk, Convex, Sentry, or UploadThing values that are missing, call that out explicitly.

## Deployment And CI Notes

- Vercel install command is `bun install --frozen-lockfile`.
- Vercel build command is `npx convex deploy --cmd='bun run build'`.
- Do not simplify deployment instructions to plain `bun run build` when documenting platform behavior.
- `README.md` and older docs may contain partial or outdated command examples; prefer `package.json`, CI, and `vercel.json` when they differ.
- Example: `docs/QA-SECURITY-SMOKE.md` still says `npm run dev`; use Bun instead.

## Agent Workflow Checklist

- Read the local area before editing; follow nearby patterns.
- Prefer existing helpers in `lib/`, `components/ui/`, and `convex/` before adding new abstractions.
- Keep changes scoped to the task.
- For code changes, verify the smallest relevant test first, then run broader checks as needed.
- Before finishing substantial work, aim to run `bun run lint`, `bun run test`, and `bun run build`.
- If you cannot run a command or lack required env/config, say so clearly and explain what remains to verify.
