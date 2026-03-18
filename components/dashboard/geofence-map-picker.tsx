'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import maplibregl, { type LngLatLike, type MapMouseEvent } from 'maplibre-gl';

import {
  attachGeofenceMarker,
  type GeofencePoint,
  type GeofenceViewport,
} from '@/lib/geofence-map';

const MAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

type GeofenceMapPickerProps = {
  selectedPoint: GeofencePoint | null;
  viewport: GeofenceViewport;
  onPointSelect: (point: GeofencePoint) => void;
};

function areViewportsClose(map: maplibregl.Map, viewport: GeofenceViewport) {
  const center = map.getCenter();
  const zoom = map.getZoom();

  return (
    Math.abs(center.lat - viewport.latitude) < 0.0001 &&
    Math.abs(center.lng - viewport.longitude) < 0.0001 &&
    Math.abs(zoom - viewport.zoom) < 0.05
  );
}

function toLngLat(point: GeofencePoint): LngLatLike {
  return [point.longitude, point.latitude];
}

function createMarkerElement() {
  const element = document.createElement('button');
  element.type = 'button';
  element.setAttribute('aria-label', 'Pusat geofence');
  element.style.width = '20px';
  element.style.height = '20px';
  element.style.borderRadius = '9999px';
  element.style.border = '3px solid white';
  element.style.background = 'rgb(13 13 18)';
  element.style.boxShadow = '0 10px 30px rgba(13, 13, 18, 0.25)';
  element.style.cursor = 'grab';
  return element;
}

export function GeofenceMapPicker({
  selectedPoint,
  viewport,
  onPointSelect,
}: GeofenceMapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const isLoadedRef = useRef(false);
  const handlePointSelect = useEffectEvent(onPointSelect);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [viewport.longitude, viewport.latitude],
      zoom: viewport.zoom,
      attributionControl: true,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    const handleLoad = () => {
      isLoadedRef.current = true;
      setIsLoaded(true);
      map.resize();
    };

    const handleError = () => {
      if (!isLoadedRef.current) {
        setMapFailed(true);
      }
    };

    const handleClick = (event: MapMouseEvent) => {
      handlePointSelect({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      });
    };

    map.on('load', handleLoad);
    map.on('error', handleError);
    map.on('click', handleClick);
    mapRef.current = map;

    return () => {
      map.off('load', handleLoad);
      map.off('error', handleError);
      map.off('click', handleClick);
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
      isLoadedRef.current = false;
    };
  }, [viewport.latitude, viewport.longitude, viewport.zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded || areViewportsClose(map, viewport)) {
      return;
    }

    map.easeTo({
      center: [viewport.longitude, viewport.latitude],
      zoom: viewport.zoom,
      duration: 400,
      essential: true,
    });
  }, [isLoaded, viewport]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) {
      return;
    }

    if (!selectedPoint) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      const marker = new maplibregl.Marker({
        draggable: true,
        element: createMarkerElement(),
        anchor: 'bottom',
      });

      markerRef.current = attachGeofenceMarker(marker, map, selectedPoint, handlePointSelect) as
        | maplibregl.Marker
        | null;
      return;
    }

    markerRef.current.setLngLat(toLngLat(selectedPoint));
  }, [isLoaded, selectedPoint]);

  if (mapFailed) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-6 text-center text-sm text-zinc-600">
        Peta tidak dapat dimuat saat ini. Anda masih bisa menyimpan radius dan akurasi GPS, lalu
        coba pilih lokasi lagi beberapa saat lagi.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm">
      <div ref={containerRef} className="h-[420px] w-full" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/92 px-3 py-2 text-xs text-zinc-600 shadow-sm backdrop-blur">
        Klik peta untuk memilih titik, lalu geser marker untuk penyesuaian akhir.
      </div>
    </div>
  );
}
