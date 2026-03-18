import {
  buildGeofenceViewport,
  buildSelectedPoint,
  syncGeofencePointToSettings,
  type GeofencePoint,
  type GeofenceSettingsDraft,
  type GeofenceViewport,
} from '@/lib/geofence-map';
import { type GeofenceSearchResult } from '@/lib/geofence-geocoder';

export type SettingsPayload = GeofenceSettingsDraft & {
  timezone: string;
  whitelistEnabled: boolean;
  whitelistIps: string[];
};

export type GeofencePanelState = {
  data: SettingsPayload;
  selectedPoint: GeofencePoint | null;
  viewport: GeofenceViewport;
};

function hasFiniteNumber(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validateGeofenceSettings(data: SettingsPayload) {
  const errors: string[] = [];

  if (!hasFiniteNumber(data.geofenceRadiusMeters) || data.geofenceRadiusMeters < 10) {
    errors.push('Radius geofence minimal 10 meter.');
  }

  if (
    !hasFiniteNumber(data.minLocationAccuracyMeters) ||
    data.minLocationAccuracyMeters <= 0
  ) {
    errors.push('Batas akurasi GPS harus lebih besar dari 0 meter.');
  }

  if (!data.geofenceEnabled) {
    return errors;
  }

  if (data.geofenceLat === undefined || data.geofenceLng === undefined) {
    errors.push('Latitude dan longitude wajib diisi saat geofence aktif.');
    return errors;
  }

  if (data.geofenceLat < -90 || data.geofenceLat > 90) {
    errors.push('Latitude geofence harus berada di antara -90 dan 90.');
  }

  if (data.geofenceLng < -180 || data.geofenceLng > 180) {
    errors.push('Longitude geofence harus berada di antara -180 dan 180.');
  }

  return errors;
}

export function buildGeofencePanelState(data: SettingsPayload): GeofencePanelState {
  const selectedPoint = buildSelectedPoint(data.geofenceLat, data.geofenceLng);

  return {
    data: syncGeofencePointToSettings(data, selectedPoint),
    selectedPoint,
    viewport: buildGeofenceViewport(selectedPoint),
  };
}

export function selectGeofencePoint(
  state: GeofencePanelState,
  selectedPoint: GeofencePoint | null,
): GeofencePanelState {
  return {
    data: syncGeofencePointToSettings(state.data, selectedPoint),
    selectedPoint,
    viewport: buildGeofenceViewport(selectedPoint),
  };
}

export function selectGeofenceSearchResult(
  state: GeofencePanelState,
  result: GeofenceSearchResult,
): GeofencePanelState {
  return selectGeofencePoint(state, {
    latitude: result.latitude,
    longitude: result.longitude,
  });
}
