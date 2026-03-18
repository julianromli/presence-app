export type GeofencePoint = {
  latitude: number;
  longitude: number;
};

export type GeofenceViewport = GeofencePoint & {
  zoom: number;
};

export type GeofenceMarkerLike<TMap = unknown> = {
  addTo: (map: TMap) => GeofenceMarkerLike<TMap>;
  getLngLat: () => { lat: number; lng: number };
  on: (event: 'dragend', handler: () => void) => GeofenceMarkerLike<TMap>;
  setLngLat: (lngLat: [number, number]) => GeofenceMarkerLike<TMap>;
};

export type GeofenceSettingsDraft = {
  geofenceEnabled: boolean;
  geofenceRadiusMeters: number;
  minLocationAccuracyMeters: number;
  geofenceLat?: number;
  geofenceLng?: number;
};

export const DEFAULT_GEOFENCE_VIEWPORT: GeofenceViewport = {
  latitude: -2.5489,
  longitude: 118.0149,
  zoom: 4,
};

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isLatitudeInRange(value: number | undefined): value is number {
  return isFiniteNumber(value) && value >= -90 && value <= 90;
}

function isLongitudeInRange(value: number | undefined): value is number {
  return isFiniteNumber(value) && value >= -180 && value <= 180;
}

export function buildSelectedPoint(
  latitude: number | undefined,
  longitude: number | undefined,
): GeofencePoint | null {
  if (!isLatitudeInRange(latitude) || !isLongitudeInRange(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

export function buildGeofenceViewport(
  selectedPoint: GeofencePoint | null,
): GeofenceViewport {
  if (!selectedPoint) {
    return DEFAULT_GEOFENCE_VIEWPORT;
  }

  return {
    ...selectedPoint,
    zoom: 16,
  };
}

export function syncGeofencePointToSettings<T extends GeofenceSettingsDraft>(
  settings: T,
  selectedPoint: GeofencePoint | null,
): T {
  return {
    ...settings,
    geofenceLat: selectedPoint?.latitude,
    geofenceLng: selectedPoint?.longitude,
  };
}

export function attachGeofenceMarker<TMap>(
  marker: GeofenceMarkerLike<TMap>,
  map: TMap,
  selectedPoint: GeofencePoint,
  onPointSelect: (point: GeofencePoint) => void,
) {
  marker.on('dragend', () => {
    const nextPoint = marker.getLngLat();
    onPointSelect({
      latitude: nextPoint.lat,
      longitude: nextPoint.lng,
    });
  });

  marker.setLngLat([selectedPoint.longitude, selectedPoint.latitude]);
  marker.addTo(map);

  return marker;
}
