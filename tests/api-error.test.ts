import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';

import { convexErrorResponse } from '../lib/api-error';

function makeConvexErrorData(code: string, message: string) {
  const error = new ConvexError(message) as ConvexError<string> & {
    data?: { code: string; message: string };
  };
  error.data = { code, message } as never;
  return error;
}

describe('convexErrorResponse', () => {
  it('maps known convex error codes to expected status', async () => {
    const response = convexErrorResponse(
      makeConvexErrorData('SPAM_DETECTED', 'Scan terlalu cepat'),
      'fallback',
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      code: 'SPAM_DETECTED',
      message: 'Scan terlalu cepat',
    });
  });

  it('maps plan limit errors to 409', async () => {
    const response = convexErrorResponse(
      makeConvexErrorData(
        'PLAN_LIMIT_REACHED',
        'Jumlah member aktif sudah mencapai batas paket workspace Anda.',
      ),
      'fallback',
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'PLAN_LIMIT_REACHED',
      message: 'Jumlah member aktif sudah mencapai batas paket workspace Anda.',
    });
  });

  it('maps feature availability errors to 403', async () => {
    const response = convexErrorResponse(
      makeConvexErrorData(
        'FEATURE_NOT_AVAILABLE',
        'Ekspor report hanya tersedia untuk paket Pro atau Enterprise.',
      ),
      'fallback',
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: 'FEATURE_NOT_AVAILABLE',
      message: 'Ekspor report hanya tersedia untuk paket Pro atau Enterprise.',
    });
  });

  it('maps invalid workspace plan errors to 400', async () => {
    const response = convexErrorResponse(
      makeConvexErrorData(
        'WORKSPACE_PLAN_INVALID',
        'WORKSPACE_PLAN_INVALID: Unknown workspace plan "starter".',
      ),
      'fallback',
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'WORKSPACE_PLAN_INVALID',
      message: 'WORKSPACE_PLAN_INVALID: Unknown workspace plan "starter".',
    });
  });

  it('maps settings-not-initialized errors to 503', async () => {
    const response = convexErrorResponse(
      makeConvexErrorData('SETTINGS_NOT_INITIALIZED', 'Global settings belum diinisialisasi.'),
      'fallback',
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'SETTINGS_NOT_INITIALIZED',
      message: 'Global settings belum diinisialisasi.',
    });
  });

  it('maps device heartbeat stale errors to 403', async () => {
    const response = convexErrorResponse(
      makeConvexErrorData('DEVICE_HEARTBEAT_STALE', 'Perangkat QR offline'),
      'fallback',
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: 'DEVICE_HEARTBEAT_STALE',
      message: 'Perangkat QR offline',
    });
  });

  it('maps device unauthorized errors to 401', async () => {
    const response = convexErrorResponse(
      makeConvexErrorData('DEVICE_UNAUTHORIZED', 'Unauthorized device'),
      'fallback',
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: 'DEVICE_UNAUTHORIZED',
      message: 'Unauthorized device',
    });
  });

  it('maps geofence configuration errors to 503', async () => {
    const response = convexErrorResponse(
      makeConvexErrorData(
        'GEOFENCE_NOT_CONFIGURED',
        'Geofence kantor belum dikonfigurasi dengan benar. Hubungi admin.',
      ),
      'fallback',
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'GEOFENCE_NOT_CONFIGURED',
      message: 'Geofence kantor belum dikonfigurasi dengan benar. Hubungi admin.',
    });
  });

  it('maps workspace delete blocked errors to 409', async () => {
    const response = convexErrorResponse(
      makeConvexErrorData(
        'WORKSPACE_DELETE_BLOCKED',
        'Kick atau nonaktifkan semua member lain sebelum menghapus workspace.',
      ),
      'fallback',
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'WORKSPACE_DELETE_BLOCKED',
      message: 'Kick atau nonaktifkan semua member lain sebelum menghapus workspace.',
    });
  });

  it('maps claimed registration code errors to 409', async () => {
    const response = convexErrorResponse(
      makeConvexErrorData(
        'REGISTRATION_CODE_CLAIMED',
        'Kode registrasi sudah dipakai.',
      ),
      'fallback',
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'REGISTRATION_CODE_CLAIMED',
      message: 'Kode registrasi sudah dipakai.',
    });
  });

  it('maps billing pending invoice errors to 409', async () => {
    const response = convexErrorResponse(
      makeConvexErrorData(
        'BILLING_PENDING_INVOICE_EXISTS',
        'Workspace masih memiliki checkout yang belum selesai.',
      ),
      'fallback',
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'BILLING_PENDING_INVOICE_EXISTS',
      message: 'Workspace masih memiliki checkout yang belum selesai.',
    });
  });

  it('maps billing active entitlement errors to 409', async () => {
    const response = convexErrorResponse(
      makeConvexErrorData(
        'BILLING_ACTIVE_ENTITLEMENT_EXISTS',
        'Workspace masih memiliki entitlement aktif.',
      ),
      'fallback',
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'BILLING_ACTIVE_ENTITLEMENT_EXISTS',
      message: 'Workspace masih memiliki entitlement aktif.',
    });
  });

  it('maps billing sync failures to 503', async () => {
    const response = convexErrorResponse(
      makeConvexErrorData('BILLING_SYNC_FAILED', 'Sinkronisasi Mayar gagal.'),
      'fallback',
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'BILLING_SYNC_FAILED',
      message: 'Sinkronisasi Mayar gagal.',
    });
  });

  it('maps restricted workspace errors to 409', async () => {
    const response = convexErrorResponse(
      makeConvexErrorData(
        'WORKSPACE_RESTRICTED_EXPIRED',
        'Dashboard diblokir sampai workspace kembali patuh ke batas paket Free.',
      ),
      'fallback',
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'WORKSPACE_RESTRICTED_EXPIRED',
      message: 'Dashboard diblokir sampai workspace kembali patuh ke batas paket Free.',
    });
  });

  it('maps forbidden text errors to 403', async () => {
    const response = convexErrorResponse(new Error('FORBIDDEN'), 'fallback');

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Forbidden',
    });
  });

  it('falls back to internal error for unknown exceptions', async () => {
    const response = convexErrorResponse(new Error('unexpected'), 'Fallback Error');

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Fallback Error',
    });
  });
});
