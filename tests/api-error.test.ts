import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';

import { convexErrorResponse } from '../lib/api-error';

function makeConvexErrorData(code: string, message: string) {
  const error = new ConvexError(message) as ConvexError<string> & {
    data?: { code: string; message: string };
  };
  error.data = { code, message };
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
