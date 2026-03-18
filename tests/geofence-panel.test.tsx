import { describe, expect, it } from 'vitest';

import {
  buildGeofencePanelState,
  validateGeofenceSettings,
} from '@/components/dashboard/geofence-panel-state';

describe('geofence panel', () => {
  it('initializes readonly coordinates from saved geofence settings', () => {
    const state = buildGeofencePanelState({
      timezone: 'Asia/Jakarta',
      geofenceEnabled: false,
      geofenceRadiusMeters: 100,
      minLocationAccuracyMeters: 50,
      geofenceLat: -6.2,
      geofenceLng: 106.8,
      whitelistEnabled: false,
      whitelistIps: [],
    });

    expect(state.data.geofenceLat).toBe(-6.2);
    expect(state.data.geofenceLng).toBe(106.8);
    expect(state.selectedPoint).toEqual({
      latitude: -6.2,
      longitude: 106.8,
    });
  });

  it('falls back to empty coordinates when saved settings do not contain a valid point', () => {
    const state = buildGeofencePanelState({
      timezone: 'Asia/Jakarta',
      geofenceEnabled: false,
      geofenceRadiusMeters: 100,
      minLocationAccuracyMeters: 50,
      geofenceLat: undefined,
      geofenceLng: undefined,
      whitelistEnabled: false,
      whitelistIps: [],
    });

    expect(state.data.geofenceLat).toBeUndefined();
    expect(state.data.geofenceLng).toBeUndefined();
    expect(state.selectedPoint).toBeNull();
  });

  it('keeps save-blocking validation when geofence is enabled without a selected point', () => {
    const errors = validateGeofenceSettings({
      timezone: 'Asia/Jakarta',
      geofenceEnabled: true,
      geofenceRadiusMeters: 100,
      minLocationAccuracyMeters: 50,
      geofenceLat: undefined,
      geofenceLng: undefined,
      whitelistEnabled: false,
      whitelistIps: [],
    });

    expect(errors).toContainEqual(expect.stringMatching(/wajib diisi/i));
  });
});
