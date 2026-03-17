import { describe, expect, it } from 'vitest';

import {
  assertValidGeofenceSettings,
  hasValidGeofenceConfiguration,
} from '../convex/helpers';

function buildSettings(overrides: Partial<{
  geofenceEnabled: boolean;
  geofenceRadiusMeters: number;
  minLocationAccuracyMeters: number;
  geofenceLat?: number;
  geofenceLng?: number;
}> = {}) {
  return {
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
});
