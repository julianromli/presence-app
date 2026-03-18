import { describe, expect, it } from 'vitest';

import {
  buildGeofencePanelState,
  selectGeofenceSearchResult,
  validateGeofenceSettings,
} from '@/components/dashboard/geofence-panel-state';

describe('geofence panel state', () => {
  it('initializes the selected point from saved settings', () => {
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

    expect(state.selectedPoint).toEqual({
      latitude: -6.2,
      longitude: 106.8,
    });
    expect(state.viewport.zoom).toBe(16);
  });

  it('updates readonly coordinates and payload values when a search result is selected', () => {
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

    const nextState = selectGeofenceSearchResult(state, {
      id: 'monas',
      label: 'Monas, Jakarta',
      latitude: -6.1754,
      longitude: 106.8272,
    });

    expect(nextState.selectedPoint).toEqual({
      latitude: -6.1754,
      longitude: 106.8272,
    });
    expect(nextState.data.geofenceLat).toBe(-6.1754);
    expect(nextState.data.geofenceLng).toBe(106.8272);
  });

  it('keeps blocking validation when geofence is enabled without a valid selected point', () => {
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

  it('preserves invalid stored coordinates so admins can inspect and repair them', () => {
    const state = buildGeofencePanelState({
      timezone: 'Asia/Jakarta',
      geofenceEnabled: false,
      geofenceRadiusMeters: 100,
      minLocationAccuracyMeters: 50,
      geofenceLat: -91,
      geofenceLng: 200,
      whitelistEnabled: false,
      whitelistIps: [],
    });

    expect(state.selectedPoint).toBeNull();
    expect(state.data.geofenceLat).toBe(-91);
    expect(state.data.geofenceLng).toBe(200);
  });
});
