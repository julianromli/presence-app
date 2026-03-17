import { describe, expect, it, vi } from 'vitest';

import {
  assertGeofenceScanAllowed,
  processScan,
} from '../convex/attendance';

function buildSettings(overrides: Partial<{
  geofenceEnabled: boolean;
  geofenceRadiusMeters: number;
  minLocationAccuracyMeters: number;
  geofenceLat?: number;
  geofenceLng?: number;
  whitelistEnabled: boolean;
  whitelistIps: string[];
  enforceDeviceHeartbeat: boolean;
  scanCooldownSeconds: number;
}> = {}) {
  return {
    geofenceEnabled: true,
    geofenceRadiusMeters: 150,
    minLocationAccuracyMeters: 50,
    geofenceLat: -6.2,
    geofenceLng: 106.8,
    whitelistEnabled: false,
    whitelistIps: [],
    enforceDeviceHeartbeat: false,
    scanCooldownSeconds: 30,
    ...overrides,
  };
}

function buildScanArgs(overrides: Partial<{
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
}> = {}) {
  return {
    latitude: -6.2,
    longitude: 106.8,
    accuracyMeters: 15,
    ...overrides,
  };
}

describe('attendance geofence policy', () => {
  it('blocks scans when geofence is enabled but not configured', () => {
    expect(() =>
      assertGeofenceScanAllowed(
        buildSettings({
          geofenceLat: undefined,
        }),
        buildScanArgs(),
      ),
    ).toThrow(/hubungi admin/i);
  });

  it('requires coordinates and accuracy when geofence is enabled', () => {
    expect(() =>
      assertGeofenceScanAllowed(
        buildSettings(),
        buildScanArgs({
          latitude: undefined,
        }),
      ),
    ).toThrow(/lokasi wajib/i);

    expect(() =>
      assertGeofenceScanAllowed(
        buildSettings(),
        buildScanArgs({
          accuracyMeters: undefined,
        }),
      ),
    ).toThrow(/akurasi gps wajib/i);
  });

  it('rejects scans with poor accuracy or outside radius', () => {
    expect(() =>
      assertGeofenceScanAllowed(
        buildSettings({
          minLocationAccuracyMeters: 10,
        }),
        buildScanArgs({
          accuracyMeters: 40,
        }),
      ),
    ).toThrow(/akurasi gps tidak mencukupi/i);

    expect(() =>
      assertGeofenceScanAllowed(
        buildSettings({
          geofenceRadiusMeters: 10,
        }),
        buildScanArgs({
          latitude: -6.201,
          longitude: 106.801,
        }),
      ),
    ).toThrow(/di luar radius/i);
  });

  it('allows scans inside the configured radius with acceptable accuracy', () => {
    expect(() =>
      assertGeofenceScanAllowed(buildSettings(), buildScanArgs()),
    ).not.toThrow();
  });

  it('returns token errors before geofence coordinate errors for invalid tokens', async () => {
    const query = vi.fn((tableName: string) => {
      if (tableName === 'scan_events') {
        return {
          withIndex: vi.fn(() => ({
            unique: vi.fn(async () => null),
          })),
        };
      }

      if (tableName === 'qr_tokens') {
        return {
          withIndex: vi.fn(() => ({
            unique: vi.fn(async () => ({
              _id: 'token_123',
              deviceId: 'device_123',
              expiresAt: Date.now() - 1,
              usedAt: undefined,
            })),
          })),
        };
      }

      if (tableName === 'device_heartbeats') {
        return {
          withIndex: vi.fn(() => ({
            unique: vi.fn(async () => null),
          })),
        };
      }

      if (tableName === 'attendance') {
        return {
          withIndex: vi.fn(() => ({
            unique: vi.fn(async () => null),
          })),
        };
      }

      throw new Error(`Unexpected table query: ${tableName}`);
    });

    await expect(
      processScan(
        {
          db: {
            query,
            get: vi.fn(async () => ({
              _id: 'device_123',
              status: 'active',
            })),
            patch: vi.fn(async () => null),
            insert: vi.fn(async () => null),
          },
        },
        {
          _id: 'user_123',
          role: 'karyawan',
        },
        {
          token: 'expired-token',
          ipAddress: '203.0.113.1',
          latitude: undefined,
          longitude: undefined,
          accuracyMeters: undefined,
          idempotencyKey: 'idem-1',
        },
        {
          settings: buildSettings(),
          now: Date.now(),
          dateKey: '2026-03-17',
          workspaceId: 'workspace_123',
        },
      ),
    ).rejects.toThrow(/expired/i);
  });
});
