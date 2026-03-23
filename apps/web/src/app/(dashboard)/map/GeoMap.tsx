'use client';

import { useEffect, useRef } from 'react';
import type { GeoPoint } from '@/lib/api/hooks/use-reports';

// Leaflet must only be imported on the client (no SSR).
// This component is loaded via dynamic() with ssr:false in the parent page.

interface Props {
  points: GeoPoint[];
}

const GPS_COLOR = '#1D4ED8';
const MAP_COLOR = '#7C3AED';

export default function GeoMap({ points }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Dynamic import keeps Leaflet out of the SSR bundle
    let L: typeof import('leaflet');
    let mounted = true;

    (async () => {
      L = await import('leaflet');

      // Fix default icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (!mounted || !containerRef.current) return;

      // Destroy existing map to avoid "container already initialized"
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(containerRef.current).setView([20, 0], 3);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      if (points.length === 0) return;

      const latlngs: [number, number][] = [];

      for (const pt of points) {
        const color = pt.captureMethod === 'gps' ? GPS_COLOR : MAP_COLOR;
        const circleMarker = L.circleMarker([pt.lat, pt.lng], {
          radius: 7,
          color,
          fillColor: color,
          fillOpacity: 0.8,
          weight: 1.5,
        }).addTo(map);

        circleMarker.bindPopup(
          `<div class="text-xs space-y-0.5">
            <p><strong>Node:</strong> ${pt.nodeCode}</p>
            <p><strong>Method:</strong> ${pt.captureMethod}</p>
            ${pt.accuracyMeters != null ? `<p><strong>Accuracy:</strong> ±${pt.accuracyMeters}m</p>` : ''}
            <p><strong>Captured:</strong> ${new Date(pt.capturedAt).toLocaleString()}</p>
          </div>`,
        );

        latlngs.push([pt.lat, pt.lng]);
      }

      // Fit map to the data extent
      map.fitBounds(L.latLngBounds(latlngs), { padding: [32, 32] });
    })();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  return (
    <>
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        crossOrigin=""
      />
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </>
  );
}
