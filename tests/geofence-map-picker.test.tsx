import { describe, expect, it } from 'vitest';

import {
  buildGeofencePanelState,
  selectGeofencePoint,
  selectGeofenceSearchResult,
} from '@/components/dashboard/geofence-panel-state';

describe('geofence map picker', () => {
  it('updates the selected point when a search result is chosen', () => {
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
      id: 'office',
      label: 'Office',
      latitude: -6.1754,
      longitude: 106.8272,
    });

    expect(nextState.selectedPoint).toEqual({
      latitude: -6.1754,
      longitude: 106.8272,
    });
    expect(nextState.viewport.zoom).toBe(16);
  });

  it('updates coordinates for direct map clicks', () => {
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

    const nextState = selectGeofencePoint(state, {
      latitude: -6.201,
      longitude: 106.82,
    });

    expect(nextState.data.geofenceLat).toBe(-6.201);
    expect(nextState.data.geofenceLng).toBe(106.82);
  });

  it('keeps draggable-marker updates in local state until save time', () => {
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

    const nextState = selectGeofencePoint(state, {
      latitude: -6.1995,
      longitude: 106.8011,
    });

    expect(nextState.selectedPoint).toEqual({
      latitude: -6.1995,
      longitude: 106.8011,
    });
    expect(nextState.data.whitelistIps).toEqual([]);
  });
});
