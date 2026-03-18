# Dev Console Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the internal `/dev` Mission Control console with layered access, global overview, workspace/user/plan management, soft-delete-only workspace handling, and audit-backed risky mutations.

**Architecture:** `/dev` is a root-level internal surface separate from the existing workspace dashboard. Next route handlers in `app/api/dev/**` own auth, validation, and HTTP shaping; Convex owns global reads, mutations, and audit persistence. The UI ships as a dedicated `components/dev/*` surface with shared typed contracts in `types/dev-console.ts` and narrow helpers in `lib/dev-*`.

**Tech Stack:** Next.js 16 App Router, React 19, Clerk, Convex, Bun, Vitest, Base UI/COSS-style primitives already used in the repo.

---

## File Map

### Create

- `docs/superpowers/plans/2026-03-18-dev-console-implementation.md`
  - This implementation plan.
- `types/dev-console.ts`
  - Global `/dev` row types, summaries, risk code unions, audit row types, and API payload types.
- `lib/dev-risk.ts`
  - Approved v1 risk code constants and helpers shared by tests, routes, and UI.
- `lib/dev-auth.ts`
  - Clerk + `publicMetadata.devAccess` + `/dev` unlock cookie guards.
- `lib/dev-filters.ts`
  - Search param parsing for overview/workspaces/users/mutations query shapes.
- `lib/dev-mutations.ts`
  - Request-body parsers for `/api/dev` mutation routes.
- `app/dev/layout.tsx`
  - Lightweight `/dev` layout that requires Clerk + metadata access but not the unlock cookie.
- `app/dev/(console)/layout.tsx`
  - Unlock-enforced console layout for the real `/dev` surface.
- `app/dev/(console)/page.tsx`
  - Main Mission Control page.
- `app/dev/login/page.tsx`
  - Second-layer unlock screen.
- `app/api/dev/unlock/route.ts`
  - Unlock endpoint that validates passphrase and sets `/dev` session cookie.
- `app/api/dev/logout/route.ts`
  - Logout endpoint that clears `/dev` session cookie.
- `app/api/dev/overview/route.ts`
  - Global overview read route.
- `app/api/dev/workspaces/route.ts`
  - Global workspace list route.
- `app/api/dev/workspaces/[workspaceId]/route.ts`
  - Workspace patch route for rename, status, invite expiry, and plan changes.
- `app/api/dev/workspaces/[workspaceId]/actions/route.ts`
  - Workspace action route for invite rotation and soft delete.
- `app/api/dev/users/route.ts`
  - Global user list route.
- `app/api/dev/users/[userId]/route.ts`
  - User mutation route for activation and resync.
- `app/api/dev/memberships/[membershipId]/route.ts`
  - Membership mutation route for role change and deactivation.
- `app/api/dev/plans/route.ts`
  - Plan distribution and workspace-plan list route.
- `app/api/dev/mutations/route.ts`
  - Audit-backed mutation feed route.
- `components/dev/dev-shell.tsx`
  - Top-level `/dev` shell layout and page scaffolding.
- `components/dev/dev-login-form.tsx`
  - Unlock form and error state handling for `/dev/login`.
- `components/dev/dev-page-header.tsx`
  - Console identity, scope badge, session status, refresh/logout actions.
- `components/dev/dev-module-switcher.tsx`
  - Switches between `Overview`, `Workspaces`, `Users`, and `Plans`.
- `components/dev/dev-overview-cards.tsx`
  - KPI cards and attention summary.
- `components/dev/dev-risk-queue.tsx`
  - Shared risk queue list view using approved risk taxonomy.
- `components/dev/dev-recent-mutations.tsx`
  - Recent audit-backed mutation feed.
- `components/dev/dev-workspace-table.tsx`
  - Workspace list + selection handling.
- `components/dev/dev-user-table.tsx`
  - User list + selection handling.
- `components/dev/dev-plan-panel.tsx`
  - Plan distribution and workspace plan detail surface.
- `components/dev/dev-context-panel.tsx`
  - Selected record detail panel.
- `components/dev/dev-danger-zone.tsx`
  - Explicitly confirmed risky actions for selected records.
- `convex/devOverview.js`
  - Global overview query and risk aggregation.
- `convex/devWorkspaces.js`
  - Global workspace list query and workspace mutations for `/dev`.
- `convex/devUsers.js`
  - Global user list query and user/membership mutations for `/dev`.
- `convex/devPlans.js`
  - Plan distribution query for `/dev`.
- `convex/devAudit.js`
  - Audit insert helpers and recent mutation list query for `/dev`.
- `tests/dev-risk-taxonomy.test.ts`
  - Risk helper coverage.
- `tests/dev-auth-guard.test.ts`
  - Auth + metadata + unlock cookie guard coverage.
- `tests/dev-unlock-route.test.ts`
  - Unlock success, failure, expiry, and rate-limit behavior.
- `tests/dev-console-page.test.tsx`
  - `/dev` page render and module switcher behavior.
- `tests/dev-login-page.test.tsx`
  - `/dev/login` page behavior.
- `tests/dev-overview-route.test.ts`
  - `/api/dev/overview` route behavior.
- `tests/dev-workspaces-route.test.ts`
  - `/api/dev/workspaces` list and mutation route behavior.
- `tests/dev-users-route.test.ts`
  - `/api/dev/users` and `/api/dev/memberships` route behavior.
- `tests/dev-plans-route.test.ts`
  - `/api/dev/plans` route behavior.
- `tests/dev-mutations-route.test.ts`
  - `/api/dev/mutations` route behavior.
- `tests/dev-workspace-soft-delete.test.ts`
  - Soft delete semantics and audit-failure behavior.
- `tests/dev-danger-zone.test.tsx`
  - Typed confirmation and destructive action UI guardrails.

### Modify

- `convex/schema.js`
  - Add any index needed for global audit or global list queries only if existing indexes are insufficient.
- `package.json`
  - Only if a dedicated test shortcut for `/dev` work materially improves iteration; otherwise leave unchanged.

### Reuse Without Modification Unless Needed

- `lib/auth.ts`
  - Reference patterns only; avoid overloading workspace-role helpers.
- `app/api/admin/**`
  - Reference structure only; do not extend workspace-scoped APIs for `/dev`.
- `components/ui/*`
  - Reuse local primitives and confirmation dialog patterns.

## Chunk 1: Access, Contracts, and Entry Surfaces

### Task 1: Define Shared `/dev` Contracts and Risk Taxonomy

**Files:**
- Create: `types/dev-console.ts`
- Create: `lib/dev-risk.ts`
- Test: `tests/dev-risk-taxonomy.test.ts`

- [ ] **Step 1: Write the failing risk taxonomy test**

```ts
import {
  DEV_RISK_CODES,
  isDevRiskCode,
  summarizeDevRiskCounts,
} from '@/lib/dev-risk';

it('accepts only approved v1 risk codes', () => {
  expect(DEV_RISK_CODES).toEqual([
    'workspace_inactive',
    'workspace_without_active_superadmin',
    'invite_expiring_24h',
    'plan_limit_reached',
    'user_inactive_with_active_membership',
    'identity_sync_mismatch',
  ]);
  expect(isDevRiskCode('plan_limit_reached')).toBe(true);
  expect(isDevRiskCode('random')).toBe(false);
  expect(
    summarizeDevRiskCounts([
      'plan_limit_reached',
      'plan_limit_reached',
      'workspace_inactive',
    ]),
  ).toMatchObject({
    plan_limit_reached: 2,
    workspace_inactive: 1,
  });
});
```

- [ ] **Step 2: Run the test to confirm the helper does not exist yet**

Run: `bun run test -- tests/dev-risk-taxonomy.test.ts`
Expected: FAIL with missing module or missing export for `@/lib/dev-risk`

- [ ] **Step 3: Implement the minimal shared contracts**

```ts
export const DEV_RISK_CODES = [
  'workspace_inactive',
  'workspace_without_active_superadmin',
  'invite_expiring_24h',
  'plan_limit_reached',
  'user_inactive_with_active_membership',
  'identity_sync_mismatch',
] as const;

export type DevRiskCode = (typeof DEV_RISK_CODES)[number];

export type DevMutationRow = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  actorEmail: string | null;
  createdAt: number;
  status: 'success' | 'failed';
};
```

- [ ] **Step 4: Add helper logic in `lib/dev-risk.ts`**

```ts
import type { DevRiskCode } from '@/types/dev-console';
import { DEV_RISK_CODES } from '@/types/dev-console';

export function isDevRiskCode(value: string): value is DevRiskCode {
  return DEV_RISK_CODES.includes(value as DevRiskCode);
}

export function summarizeDevRiskCounts(codes: DevRiskCode[]) {
  return codes.reduce<Record<DevRiskCode, number>>((acc, code) => {
    acc[code] += 1;
    return acc;
  }, {
    workspace_inactive: 0,
    workspace_without_active_superadmin: 0,
    invite_expiring_24h: 0,
    plan_limit_reached: 0,
    user_inactive_with_active_membership: 0,
    identity_sync_mismatch: 0,
  });
}
```

- [ ] **Step 5: Re-run the test**

Run: `bun run test -- tests/dev-risk-taxonomy.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the foundation**

```bash
git add types/dev-console.ts lib/dev-risk.ts tests/dev-risk-taxonomy.test.ts
git commit -m "feat(dev): add shared dev console contracts"
```

### Task 2: Add `/dev` Auth Guards and Unlock Session Rules

**Files:**
- Create: `lib/dev-auth.ts`
- Test: `tests/dev-auth-guard.test.ts`

- [ ] **Step 1: Write failing guard tests**

```ts
it('rejects when Clerk user is missing', async () => {
  await expect(requireDevAccessPage()).rejects.toThrow();
});

it('rejects when publicMetadata.devAccess is not true', async () => {
  await expect(requireDevAccessPage()).rejects.toThrow();
});

it('accepts signed-in user with dev metadata and valid unlock cookie', async () => {
  const session = await getDevAccessSession();
  expect(session?.canAccess).toBe(true);
});

it('returns a response error for /api/dev when metadata or unlock is missing', async () => {
  const result = await requireDevAccessApi();
  expect('error' in result).toBe(true);
});

it('returns a refreshed cookie for successful protected API access', async () => {
  const result = await requireDevAccessApi();
  if ('error' in result) throw new Error('expected unlocked session');
  expect(result.refreshCookie).toContain('Path=/dev');
  expect(result.refreshCookie).toContain('Max-Age=1800');
});
```

- [ ] **Step 2: Run the guard test file**

Run: `bun run test -- tests/dev-auth-guard.test.ts`
Expected: FAIL with missing `@/lib/dev-auth`

- [ ] **Step 3: Implement `/dev` auth helpers**

```ts
export async function getDevAccessSession() {
  const clerkSession = await auth();
  const user = await currentUser();
  const unlockCookie = (await cookies()).get(DEV_UNLOCK_COOKIE)?.value ?? null;
  const fingerprint = getDevRequestFingerprintFromCookieOrRequest();

  return {
    isSignedIn: Boolean(clerkSession.userId),
    hasMetadataAccess: user?.publicMetadata?.devAccess === true,
    fingerprint,
    unlocked: validateDevUnlockCookie(unlockCookie),
    canAccess: Boolean(clerkSession.userId) &&
      user?.publicMetadata?.devAccess === true &&
      validateDevUnlockCookie(unlockCookie),
  };
}

export async function requireDevAccessApi() {
  const session = await getDevAccessSession();
  if (!session.isSignedIn) {
    return { error: Response.json({ code: 'UNAUTHENTICATED' }, { status: 401 }) };
  }
  if (!session.hasMetadataAccess) {
    return { error: Response.json({ code: 'FORBIDDEN' }, { status: 403 }) };
  }
  if (!session.unlocked) {
    return { error: Response.json({ code: 'DEV_UNLOCK_REQUIRED' }, { status: 423 }) };
  }
  return {
    session,
    refreshCookie: createDevUnlockCookie({
      fingerprint: session.fingerprint,
      issuedAt: Date.now(),
    }),
  };
}
```

- [ ] **Step 4: Encode the approved unlock rules in the helper layer**

Implement constants and pure helpers for:

- cookie name
- 30-minute sliding TTL
- max 5 failed attempts
- 15-minute lockout
- logout invalidation via cookie clear
- `requireDevAccessApi()` response shape for protected `/api/dev/*`

Use pure functions for TTL and lockout math so tests stay cheap.

Make sliding TTL explicit:

- every successful protected `/api/dev/*` request should be able to reissue the unlock cookie with a fresh 30-minute expiry
- route handlers in later chunks must attach `refreshCookie` when `requireDevAccessApi()` returns one

- [ ] **Step 5: Re-run the auth guard tests**

Run: `bun run test -- tests/dev-auth-guard.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the auth helper**

```bash
git add lib/dev-auth.ts tests/dev-auth-guard.test.ts
git commit -m "feat(dev): add layered dev auth guard"
```

### Task 3: Build `/dev/login` and `/dev` Entry Points

**Files:**
- Create: `app/dev/layout.tsx`
- Create: `app/dev/(console)/layout.tsx`
- Create: `app/dev/(console)/page.tsx`
- Create: `app/dev/login/page.tsx`
- Create: `app/api/dev/unlock/route.ts`
- Create: `app/api/dev/logout/route.ts`
- Create: `components/dev/dev-shell.tsx`
- Create: `components/dev/dev-login-form.tsx`
- Create: `components/dev/dev-page-header.tsx`
- Test: `tests/dev-unlock-route.test.ts`
- Test: `tests/dev-console-page.test.tsx`
- Test: `tests/dev-login-page.test.tsx`

- [ ] **Step 1: Write failing tests for unlock and page gating**

```ts
it('sets the /dev unlock cookie on valid passphrase', async () => {
  const res = await POST(new Request('http://localhost/api/dev/unlock', {
    method: 'POST',
    body: JSON.stringify({ passphrase: 'correct-passphrase' }),
  }));
  expect(res.status).toBe(200);
  expect(res.headers.get('set-cookie')).toContain('HttpOnly');
  expect(res.headers.get('set-cookie')).toContain('Path=/dev');
});

it('sets Secure on the cookie in production', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  const res = await POST(new Request('http://localhost/api/dev/unlock', {
    method: 'POST',
    body: JSON.stringify({ passphrase: 'correct-passphrase' }),
  }));
  expect(res.headers.get('set-cookie')).toContain('Secure');
});

it('redirects /dev to /dev/login when unlock is missing', async () => {
  const html = await renderDevPageWithoutUnlock();
  expect(html).toContain('/dev/login');
});

it('rejects invalid passphrase attempts and eventually locks out', async () => {
  for (let i = 0; i < 5; i += 1) {
    const res = await POST(new Request('http://localhost/api/dev/unlock', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.10' },
      body: JSON.stringify({ passphrase: 'wrong-passphrase' }),
    }));
    expect(res.status).toBe(401);
  }

  const locked = await POST(new Request('http://localhost/api/dev/unlock', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.10' },
    body: JSON.stringify({ passphrase: 'wrong-passphrase' }),
  }));
  expect(locked.status).toBe(423);

  vi.advanceTimersByTime(15 * 60 * 1000);
  const recovered = await POST(new Request('http://localhost/api/dev/unlock', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.10' },
    body: JSON.stringify({ passphrase: 'correct-passphrase' }),
  }));
  expect(recovered.status).toBe(200);
});

it('redirects expired or tampered unlock cookies back to /dev/login', async () => {
  const html = await renderDevPageWithInvalidUnlockCookie();
  expect(html).toContain('/dev/login');
});

it('clears the /dev unlock cookie on logout', async () => {
  const res = await POST(new Request('http://localhost/api/dev/logout', { method: 'POST' }));
  expect(res.headers.get('set-cookie')).toContain('Path=/dev');
  expect(res.headers.get('set-cookie')).toContain('Max-Age=0');
});

it('/dev/login rejects missing Clerk auth or missing devAccess metadata', async () => {
  const noClerk = await renderDevLoginWithoutClerk();
  const noMetadata = await renderDevLoginWithoutMetadata();
  expect(noClerk).toContain('/sign-in');
  expect(noMetadata).toContain('/forbidden');
});
```

- [ ] **Step 2: Run the new test files**

Run: `bun run test -- tests/dev-unlock-route.test.ts tests/dev-console-page.test.tsx tests/dev-login-page.test.tsx`
Expected: FAIL with missing routes/components

- [ ] **Step 3: Implement unlock and logout routes**

Use `lib/dev-auth.ts` helpers for:

- passphrase validation against env-backed secret
- failed attempt counting and lockout
- signed cookie creation
- logout cookie clearing
- expired or invalid cookie handling
- `httpOnly` cookie flag
- `secure` in production
- `/dev` path scoping

Use a dedicated request fingerprint helper with this exact priority:

1. Clerk `userId` when available
2. `x-forwarded-for` first IP when present
3. request IP fallback from the runtime if exposed

Hash the final fingerprint string before storing counters so the lockout key is stable and non-plain-text.

Minimal handler shape:

```ts
export async function POST(req: Request) {
  const body = await req.json();
  const fingerprint = getDevRequestFingerprint(req);
  const result = await validateDevUnlockAttempt({
    passphrase: body.passphrase,
    fingerprint,
  });
  if (!result.ok) return Response.json(result.error, { status: result.status });
  return Response.json({ ok: true }, {
    headers: { 'set-cookie': result.cookie },
  });
}
```

- [ ] **Step 4: Implement `app/dev` entry surfaces**

Requirements:

- `app/dev/layout.tsx` must require Clerk auth plus `publicMetadata.devAccess === true`, but not the unlock cookie
- `app/dev/(console)/layout.tsx` must use `requireDevAccessPage()`
- `app/dev/(console)/page.tsx` must render the Mission Control shell stub
- `app/dev/login/page.tsx` must render the unlock form and error state
- `components/dev/dev-page-header.tsx` must only include identity, scope badge, session state, refresh, and logout
- `/dev/login` must stay reachable after Clerk+metadata success even when unlock is missing

- [ ] **Step 5: Re-run the page and unlock tests**

Run: `bun run test -- tests/dev-unlock-route.test.ts tests/dev-console-page.test.tsx tests/dev-login-page.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit the entry surfaces**

```bash
git add app/dev app/api/dev/unlock/route.ts app/api/dev/logout/route.ts components/dev/dev-shell.tsx components/dev/dev-login-form.tsx components/dev/dev-page-header.tsx tests/dev-unlock-route.test.ts tests/dev-console-page.test.tsx tests/dev-login-page.test.tsx
git commit -m "feat(dev): add dev console entry surfaces"
```

## Chunk 2: Global Data, Mission Control UI, and Risky Mutations

### Task 4: Add Global Convex Queries and `/api/dev` Read Routes

**Files:**
- Create: `convex/devOverview.js`
- Create: `convex/devWorkspaces.js`
- Create: `convex/devUsers.js`
- Create: `convex/devPlans.js`
- Create: `convex/devAudit.js`
- Modify: `convex/schema.js`
- Create: `lib/dev-filters.ts`
- Create: `app/api/dev/overview/route.ts`
- Create: `app/api/dev/workspaces/route.ts`
- Create: `app/api/dev/users/route.ts`
- Create: `app/api/dev/plans/route.ts`
- Create: `app/api/dev/mutations/route.ts`
- Test: `tests/dev-overview-route.test.ts`
- Test: `tests/dev-workspaces-route.test.ts`
- Test: `tests/dev-users-route.test.ts`
- Test: `tests/dev-plans-route.test.ts`
- Test: `tests/dev-mutations-route.test.ts`

- [ ] **Step 1: Write failing route tests for the read APIs**

```ts
it('returns overview KPIs and approved risk totals', async () => {
  const res = await GET(new Request('http://localhost/api/dev/overview'));
  expect(res.status).toBe(200);
  expect(res.headers.get('set-cookie')).toContain('Max-Age=1800');
});

it('returns paginated workspaces with risk codes', async () => {
  const res = await GET(new Request('http://localhost/api/dev/workspaces?status=all&limit=20'));
  const payload = await res.json();
  expect(payload.rows[0].riskCodes).toBeDefined();
});

it('rejects protected read routes when unlock is missing', async () => {
  const res = await GET(new Request('http://localhost/api/dev/workspaces?status=all&limit=20'));
  expect([401, 403, 423]).toContain(res.status);
});
```

- [ ] **Step 2: Run the read-route tests**

Run: `bun run test -- tests/dev-overview-route.test.ts tests/dev-workspaces-route.test.ts tests/dev-users-route.test.ts tests/dev-plans-route.test.ts tests/dev-mutations-route.test.ts`
Expected: FAIL with missing routes and/or missing Convex functions

- [ ] **Step 3: Add global query functions**

Implement Convex responsibilities as separate files:

- `convex/devOverview.js`
  - totals + attention buckets + recent mutations
- `convex/devWorkspaces.js`
  - global list query with risk tagging
- `convex/devUsers.js`
  - global user list query with risk tagging
- `convex/devPlans.js`
  - distribution and workspace plan snapshot query
- `convex/devAudit.js`
  - recent mutation query and reusable audit insert helper

If `audit_logs` needs a more direct query path for `/api/dev/mutations`, add only the index actually needed in `convex/schema.js`.

- [ ] **Step 4: Add route-layer validation and HTTP shaping**

Implement `lib/dev-filters.ts` so route handlers parse and validate:

- `q`
- `status`
- `plan`
- `risk`
- `role`
- `targetType`
- `action`
- `cursor`
- `limit`
- `sort`

Each handler should follow the existing admin-route pattern:

```ts
const session = await requireDevAccessApi();
if ('error' in session) return session.error;

const token = await getConvexTokenOrNull();
const convex = getAuthedConvexHttpClient(token);
const query = normalizeDevWorkspaceQuery(new URL(req.url).searchParams);
const result = await convex.query('devWorkspaces:list', query);
return Response.json(result, {
  headers: { 'set-cookie': session.refreshCookie },
});
```

- [ ] **Step 5: Re-run the read-route tests**

Run: `bun run test -- tests/dev-overview-route.test.ts tests/dev-workspaces-route.test.ts tests/dev-users-route.test.ts tests/dev-plans-route.test.ts tests/dev-mutations-route.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the global data layer**

```bash
git add convex/devOverview.js convex/devWorkspaces.js convex/devUsers.js convex/devPlans.js convex/devAudit.js convex/schema.js lib/dev-filters.ts app/api/dev/overview/route.ts app/api/dev/workspaces/route.ts app/api/dev/users/route.ts app/api/dev/plans/route.ts app/api/dev/mutations/route.ts tests/dev-overview-route.test.ts tests/dev-workspaces-route.test.ts tests/dev-users-route.test.ts tests/dev-plans-route.test.ts tests/dev-mutations-route.test.ts
git commit -m "feat(dev): add global dev console read APIs"
```

### Task 5: Render the Mission Control Overview

**Files:**
- Modify: `app/dev/(console)/page.tsx`
- Create: `components/dev/dev-module-switcher.tsx`
- Create: `components/dev/dev-overview-cards.tsx`
- Create: `components/dev/dev-risk-queue.tsx`
- Create: `components/dev/dev-recent-mutations.tsx`
- Test: `tests/dev-console-page.test.tsx`

- [ ] **Step 1: Extend the page test to cover Mission Control overview**

```tsx
it('renders overview cards, risk queue, and recent mutations', async () => {
  render(<DevConsolePage />);
  expect(screen.getByText('Attention Needed')).toBeInTheDocument();
  expect(screen.getByText('Recent Mutations')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the page test**

Run: `bun run test -- tests/dev-console-page.test.tsx`
Expected: FAIL because the overview modules are still stubs

- [ ] **Step 3: Implement the overview components**

Rules:

- `DevOverviewCards` renders KPI cards and risk counts only from approved risk codes
- `DevRiskQueue` renders actionable records and links selection into the context panel
- `DevRecentMutations` renders audit-backed entries from `/api/dev/mutations`
- `DevModuleSwitcher` switches among `Overview`, `Workspaces`, `Users`, and `Plans`

- [ ] **Step 4: Wire `app/dev/(console)/page.tsx` to the overview data**

Keep the page focused:

- fetch overview data
- hold selected module state
- pass selected record into later context-panel wiring

Do not add a command palette or arbitrary quick actions.

- [ ] **Step 5: Re-run the page test**

Run: `bun run test -- tests/dev-console-page.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit the overview UI**

```bash
git add app/dev/(console)/page.tsx components/dev/dev-module-switcher.tsx components/dev/dev-overview-cards.tsx components/dev/dev-risk-queue.tsx components/dev/dev-recent-mutations.tsx tests/dev-console-page.test.tsx
git commit -m "feat(dev): render mission control overview"
```

### Task 6: Add Workspace, User, and Plan Management Panels

**Files:**
- Create: `components/dev/dev-workspace-table.tsx`
- Create: `components/dev/dev-user-table.tsx`
- Create: `components/dev/dev-plan-panel.tsx`
- Create: `components/dev/dev-context-panel.tsx`
- Test: `tests/dev-console-page.test.tsx`

- [ ] **Step 1: Extend the page test for module switching and selection**

```tsx
it('switches to workspaces and shows selected workspace detail', async () => {
  render(<DevConsolePage />);
  await user.click(screen.getByRole('tab', { name: 'Workspaces' }));
  expect(screen.getByText('Workspace Detail')).toBeInTheDocument();
});

it('renders the subscription history placeholder in the plan module', async () => {
  render(<DevConsolePage />);
  await user.click(screen.getByRole('tab', { name: 'Plans' }));
  expect(screen.getByText(/integrated soon/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the page test again**

Run: `bun run test -- tests/dev-console-page.test.tsx`
Expected: FAIL because module tables and context panel do not exist yet

- [ ] **Step 3: Implement the three management panels**

Requirements:

- `DevWorkspaceTable`
  - global list, status/plan/risk filters, selection
- `DevUserTable`
  - global list, status/role/risk filters, selection
- `DevPlanPanel`
  - plan distribution summary and selected workspace plan detail
- `DevContextPanel`
  - selected workspace/user/plan detail summary only, no destructive actions yet

- [ ] **Step 4: Wire module data sources and placeholder subscription history**

Requirements:

- use `/api/dev/workspaces`, `/api/dev/users`, `/api/dev/plans`
- render the approved frontend-only `subscription history` placeholder inside the plan surface
- keep filters aligned with `lib/dev-filters.ts`

- [ ] **Step 5: Re-run the page test**

Run: `bun run test -- tests/dev-console-page.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit the management panels**

```bash
git add components/dev/dev-workspace-table.tsx components/dev/dev-user-table.tsx components/dev/dev-plan-panel.tsx components/dev/dev-context-panel.tsx app/dev/(console)/page.tsx tests/dev-console-page.test.tsx
git commit -m "feat(dev): add workspace user and plan panels"
```

### Task 7: Implement Risky Mutations, Audit Failure Rules, and Final Verification

**Files:**
- Create: `lib/dev-mutations.ts`
- Create: `components/dev/dev-danger-zone.tsx`
- Create: `app/api/dev/workspaces/[workspaceId]/route.ts`
- Create: `app/api/dev/workspaces/[workspaceId]/actions/route.ts`
- Create: `app/api/dev/users/[userId]/route.ts`
- Create: `app/api/dev/memberships/[membershipId]/route.ts`
- Test: `tests/dev-workspaces-route.test.ts`
- Test: `tests/dev-users-route.test.ts`
- Test: `tests/dev-workspace-soft-delete.test.ts`
- Test: `tests/dev-danger-zone.test.tsx`
- Test: `tests/dev-console-page.test.tsx`

- [ ] **Step 1: Add failing mutation tests**

```ts
it('soft deletes a workspace and preserves related records', async () => {
  const res = await POST(new Request('http://localhost/api/dev/workspaces/ws_1/actions', {
    method: 'POST',
    body: JSON.stringify({ action: 'softDeleteWorkspace', confirmText: 'DELETE' }),
  }));
  expect(res.status).toBe(200);
  expect(res.headers.get('set-cookie')).toContain('Max-Age=1800');
});

it('fails the request when audit persistence fails', async () => {
  const res = await PATCH(new Request('http://localhost/api/dev/users/user_1', {
    method: 'PATCH',
    body: JSON.stringify({ action: 'setUserActive', isActive: false }),
  }));
  expect(res.status).toBe(500);
});

it('requires typed confirmation for workspace soft delete in the UI', async () => {
  render(<DevDangerZone selectedWorkspace={workspaceFixture} />);
  await user.click(screen.getByRole('button', { name: /hapus workspace/i }));
  expect(screen.getByText(/ketik/i)).toBeInTheDocument();
});

it('writes an audit row for important mutations', async () => {
  const res = await PATCH(new Request('http://localhost/api/dev/users/user_1', {
    method: 'PATCH',
    body: JSON.stringify({ action: 'setUserActive', isActive: false }),
  }));
  expect(res.status).toBe(200);
  expect(mockAuditInsert).toHaveBeenCalledWith(expect.objectContaining({
    action: expect.any(String),
    targetId: expect.any(String),
  }));
});

it('refreshes the selected module and Recent Mutations after a successful dangerous action', async () => {
  render(<DevConsolePage />);
  await user.click(screen.getByRole('tab', { name: 'Workspaces' }));
  await user.click(screen.getByRole('button', { name: /putar ulang invite/i }));
  expect(mockRefreshModule).toHaveBeenCalled();
  expect(mockRefreshMutations).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the mutation test files**

Run: `bun run test -- tests/dev-workspaces-route.test.ts tests/dev-users-route.test.ts tests/dev-workspace-soft-delete.test.ts tests/dev-danger-zone.test.tsx tests/dev-console-page.test.tsx`
Expected: FAIL because mutation parsers/routes are missing or incomplete

- [ ] **Step 3: Implement mutation parsers and routes**

`lib/dev-mutations.ts` should parse only approved actions:

- workspace rename
- workspace activate/deactivate
- invite expiry update
- plan change
- invite rotation
- workspace soft delete
- user activate/deactivate
- user resync trigger
- membership role change
- membership deactivation

Route handlers should reject anything else with `400`.

Successful mutation handlers must also attach the renewed unlock cookie from `requireDevAccessApi()`:

```ts
return Response.json({ ok: true }, {
  headers: { 'set-cookie': session.refreshCookie },
});
```

- [ ] **Step 4: Implement Convex mutation wiring with fail-closed audit behavior**

Requirements:

- use `convex/devAudit.js` helper inside every important mutation
- if audit insert fails, surface a failure response and do not report success
- `softDeleteWorkspace` must:
  - set workspace inactive
  - revoke active invite codes
  - preserve users, memberships, devices, attendance, and audit history

- [ ] **Step 5: Connect the UI danger zone**

`components/dev/dev-danger-zone.tsx` should:

- live inside the right context panel
- show selected-record actions only
- require stronger confirmation for workspace soft delete
- refresh the relevant module and `Recent Mutations` after success

- [ ] **Step 6: Re-run focused tests**

Run: `bun run test -- tests/dev-workspaces-route.test.ts tests/dev-users-route.test.ts tests/dev-workspace-soft-delete.test.ts tests/dev-danger-zone.test.tsx tests/dev-console-page.test.tsx`
Expected: PASS

- [ ] **Step 7: Run repository-wide verification for touched areas**

Run: `bun run test -- tests/dev-risk-taxonomy.test.ts tests/dev-auth-guard.test.ts tests/dev-unlock-route.test.ts tests/dev-console-page.test.tsx tests/dev-login-page.test.tsx tests/dev-overview-route.test.ts tests/dev-workspaces-route.test.ts tests/dev-users-route.test.ts tests/dev-plans-route.test.ts tests/dev-mutations-route.test.ts tests/dev-workspace-soft-delete.test.ts tests/dev-danger-zone.test.tsx`
Expected: PASS

Run: `bun run lint`
Expected: PASS with no new lint errors in touched files

- [ ] **Step 8: Commit the risky mutation layer**

```bash
git add lib/dev-mutations.ts components/dev/dev-danger-zone.tsx app/api/dev/workspaces/[workspaceId]/route.ts app/api/dev/workspaces/[workspaceId]/actions/route.ts app/api/dev/users/[userId]/route.ts app/api/dev/memberships/[membershipId]/route.ts tests/dev-workspaces-route.test.ts tests/dev-users-route.test.ts tests/dev-workspace-soft-delete.test.ts tests/dev-danger-zone.test.tsx tests/dev-console-page.test.tsx
git commit -m "feat(dev): add audited dev console mutations"
```

## Execution Notes

- Keep `/dev` fully separate from `app/api/admin/**` and `requireWorkspaceRole*` helpers.
- Prefer reusing existing confirmation-dialog and table primitives instead of introducing a new UI system.
- Do not add command palette or non-approved quick actions in this plan.
- If any planned file starts growing too large, split by responsibility before continuing.

Plan complete and saved to `docs/superpowers/plans/2026-03-18-dev-console-implementation.md`. Ready to execute?
