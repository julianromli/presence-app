import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GEOFENCE_VIEWPORT,
  attachGeofenceMarker,
  buildGeofenceViewport,
  buildSelectedPoint,
  syncGeofencePointToSettings,
} from '@/lib/geofence-map';

describe('geofence map helpers', () => {
  it('creates a selected point only for valid coordinate pairs', () => {
    expect(buildSelectedPoint(-6.2, 106.8)).toEqual({
      latitude: -6.2,
      longitude: 106.8,
    });

    expect(buildSelectedPoint(undefined, 106.8)).toBeNull();
    expect(buildSelectedPoint(-91, 106.8)).toBeNull();
  });

  it('uses a tighter viewport when a selected point exists', () => {
    expect(
      buildGeofenceViewport({
        latitude: -6.2,
        longitude: 106.8,
      }),
    ).toEqual({
      latitude: -6.2,
      longitude: 106.8,
      zoom: 16,
    });
  });

  it('falls back to the Indonesia-oriented default viewport without a selected point', () => {
    expect(buildGeofenceViewport(null)).toEqual(DEFAULT_GEOFENCE_VIEWPORT);
  });

  it('projects a selected point back into the settings payload shape', () => {
    expect(
      syncGeofencePointToSettings(
        {
          geofenceEnabled: true,
          geofenceRadiusMeters: 150,
          minLocationAccuracyMeters: 25,
          geofenceLat: undefined,
          geofenceLng: undefined,
        },
        {
          latitude: -6.1754,
          longitude: 106.8272,
        },
      ),
    ).toMatchObject({
      geofenceLat: -6.1754,
      geofenceLng: 106.8272,
    });
  });

  it('sets marker coordinates before adding the marker to the map', () => {
    const callOrder: string[] = [];
    const marker = {
      addTo: () => {
        callOrder.push('addTo');
        return marker;
      },
      getLngLat: () => ({ lat: -6.1754, lng: 106.8272 }),
      on: () => {
        callOrder.push('on');
        return marker;
      },
      setLngLat: () => {
        callOrder.push('setLngLat');
        return marker;
      },
    };

    attachGeofenceMarker(
      marker,
      { id: 'map' },
      {
        latitude: -6.1754,
        longitude: 106.8272,
      },
      () => {},
    );

    expect(callOrder).toEqual(['on', 'setLngLat', 'addTo']);
  });
});
