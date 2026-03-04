import { beforeEach, describe, expect, it, vi } from 'vitest';

type ScanRouteSetupOptions = {
  roleResult?: { error: Response } | { session: { role: string } };
  convexToken?: string | null;
  mutationImpl?: () => Promise<unknown>;
};

async function setupScanRoute(options: ScanRouteSetupOptions = {}) {
  vi.resetModules();

  const requireRoleApiFromDb = vi.fn(async () => options.roleResult ?? { session: { role: 'karyawan' } });
  const getConvexTokenOrNull = vi.fn(async () =>
    options.convexToken === undefined ? 'convex-token' : options.convexToken,
  );
  const mutation = vi.fn(
    options.mutationImpl ??
      (async () => ({
        status: 'check-in',
        dateKey: '2026-03-04',
        message: 'Check-in berhasil',
      })),
  );
  const getAuthedConvexHttpClient = vi.fn(() => ({ mutation }));

  vi.doMock('@/lib/auth', () => ({
    requireRoleApiFromDb,
    getConvexTokenOrNull,
  }));
  vi.doMock('@/lib/convex-http', () => ({
    getAuthedConvexHttpClient,
  }));
  vi.doMock('@/lib/api-error', () => ({
    convexErrorResponse: vi.fn((_: unknown, fallbackMessage: string) =>
      Response.json(
        {
          code: 'INTERNAL_ERROR',
          message: fallbackMessage,
        },
        { status: 500 },
      ),
    ),
  }));

  const routeModule = await import('../app/api/scan/route');
  return {
    POST: routeModule.POST,
    mocks: {
      requireRoleApiFromDb,
      getConvexTokenOrNull,
      getAuthedConvexHttpClient,
      mutation,
    },
  };
}

describe('scan route guardrails', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns role guard response when requester is forbidden', async () => {
    const denied = Response.json({ code: 'FORBIDDEN', message: 'Forbidden' }, { status: 403 });
    const { POST, mocks } = await setupScanRoute({ roleResult: { error: denied } });

    const response = await POST(
      new Request('http://localhost/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'abc' }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ code: 'FORBIDDEN', message: 'Forbidden' });
    expect(mocks.mutation).not.toHaveBeenCalled();
  });

  it('rejects payload without token', async () => {
    const { POST, mocks } = await setupScanRoute();

    const response = await POST(
      new Request('http://localhost/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Token wajib diisi',
    });
    expect(mocks.getConvexTokenOrNull).not.toHaveBeenCalled();
  });

  it('returns 401 when convex token is missing', async () => {
    const { POST } = await setupScanRoute({ convexToken: null });

    const response = await POST(
      new Request('http://localhost/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'abc' }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: 'Unauthorized' });
  });

  it('forwards first ip from x-forwarded-for to attendance mutation', async () => {
    const { POST, mocks } = await setupScanRoute();

    const response = await POST(
      new Request('http://localhost/api/scan', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.1, 10.0.0.2',
        },
        body: JSON.stringify({
          token: 'token-active',
          latitude: -6.2,
          longitude: 106.8,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.mutation).toHaveBeenCalledWith('attendance:recordScan', {
      token: 'token-active',
      ipAddress: '203.0.113.1',
      latitude: -6.2,
      longitude: 106.8,
    });
  });

  it('maps convex mutation errors to standard api error response', async () => {
    const { POST } = await setupScanRoute({
      mutationImpl: async () => {
        throw new Error('unexpected failure');
      },
    });

    const response = await POST(
      new Request('http://localhost/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: 'abc' }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Scan gagal diproses.',
    });
  });
});
