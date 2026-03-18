import { describe, expect, it } from 'vitest';

import {
  buildDateKey,
  assertValidGeofenceSettings,
  hasValidGeofenceConfiguration,
} from '../convex/helpers';

function buildSettings(overrides: Partial<{
  geofenceEnabled: boolean;
  geofenceRadiusMeters: number;
  minLocationAccuracyMeters: number;
  timezone: string;
  geofenceLat?: number;
  geofenceLng?: number;
}> = {}) {
  return {
    timezone: 'Asia/Jakarta',
    geofenceEnabled: false,
    geofenceRadiusMeters: 100,
    minLocationAccuracyMeters: 50,
    geofenceLat: -6.2,
    geofenceLng: 106.8,
    ...overrides,
  };
}

describe('geofence settings validation', () => {
  it('rejects enabled geofence without center coordinates', () => {
    expect(() =>
      assertValidGeofenceSettings(
        buildSettings({
          geofenceEnabled: true,
          geofenceLat: undefined,
        }),
      ),
    ).toThrow(/wajib diisi/i);
  });

  it('rejects latitude and longitude outside valid ranges', () => {
    expect(() =>
      assertValidGeofenceSettings(
        buildSettings({
          geofenceEnabled: true,
          geofenceLat: -91,
        }),
      ),
    ).toThrow(/latitude/i);

    expect(() =>
      assertValidGeofenceSettings(
        buildSettings({
          geofenceEnabled: true,
          geofenceLng: 181,
        }),
      ),
    ).toThrow(/longitude/i);
  });

  it('rejects invalid radius values', () => {
    expect(() =>
      assertValidGeofenceSettings(
        buildSettings({
          geofenceRadiusMeters: 0,
        }),
      ),
    ).toThrow(/radius/i);
  });

  it('rejects invalid accuracy thresholds', () => {
    expect(() =>
      assertValidGeofenceSettings(
        buildSettings({
          minLocationAccuracyMeters: 0,
        }),
      ),
    ).toThrow(/akurasi gps/i);
  });

  it('allows disabled geofence with stored coordinates', () => {
    expect(() =>
      assertValidGeofenceSettings(
        buildSettings({
          geofenceEnabled: false,
          geofenceLat: -6.21,
          geofenceLng: 106.81,
        }),
      ),
    ).not.toThrow();
  });

  it('rejects invalid timezone values', () => {
    expect(() =>
      assertValidGeofenceSettings(
        buildSettings({
          timezone: 'Invalid/Timezone',
        }),
      ),
    ).toThrow(/timezone/i);
  });

  it('reports whether an enabled geofence configuration is usable at runtime', () => {
    expect(
      hasValidGeofenceConfiguration(
        buildSettings({
          geofenceEnabled: true,
        }),
      ),
    ).toBe(true);

    expect(
      hasValidGeofenceConfiguration(
        buildSettings({
          geofenceEnabled: true,
          geofenceLat: undefined,
        }),
      ),
    ).toBe(false);
  });

  it('falls back to Asia/Jakarta when a legacy timezone value is invalid', () => {
    const ts = new Date('2026-03-05T17:00:00.000Z').getTime();

    expect(buildDateKey(ts, 'Invalid/Timezone')).toBe('2026-03-06');
  });
});
