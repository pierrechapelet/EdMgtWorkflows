'use client';

import dynamic from 'next/dynamic';
import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGeoPoints, type GeoPoint } from '@/lib/api/hooks/use-reports';

// Dynamic import prevents Leaflet from running on the server
const GeoMap = dynamic(() => import('./GeoMap'), { ssr: false });

// ── Legend ─────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="absolute bottom-4 start-4 z-[1000] bg-card border rounded-lg p-3 shadow-md text-xs space-y-1.5">
      <p className="font-semibold text-sm mb-2">Capture method</p>
      <div className="flex items-center gap-2">
        <span className="inline-block w-3 h-3 rounded-full bg-blue-600" />
        <span>GPS</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block w-3 h-3 rounded-full bg-violet-600" />
        <span>Map selection</span>
      </div>
    </div>
  );
}

// ── Sidebar summary ────────────────────────────────────────────────────────────

function PointSidebar({ points }: { points: GeoPoint[] }) {
  const byNode = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of points) {
      m.set(p.nodeCode, (m.get(p.nodeCode) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [points]);

  if (points.length === 0)
    return (
      <div className="text-sm text-muted-foreground text-center py-8">No points in view.</div>
    );

  return (
    <div className="space-y-1 text-sm">
      <p className="font-semibold mb-2">{points.length} point(s)</p>
      {byNode.map(([code, count]) => (
        <div key={code} className="flex justify-between">
          <span className="text-muted-foreground">{code}</span>
          <span className="font-medium">{count}</span>
        </div>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function GeoMapPage() {
  const searchParams = useSearchParams();
  const [campaignId, setCampaignId] = useState(searchParams.get('campaign') ?? '');

  const { data: points = [], isLoading, isError } = useGeoPoints(campaignId);

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-6 py-3 border-b bg-card flex-shrink-0">
        <h1 className="text-lg font-semibold whitespace-nowrap">Geo Submissions Map</h1>
        <input
          className="border rounded-md px-3 py-1.5 text-sm flex-1 max-w-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Campaign UUID…"
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value.trim())}
        />
        {isLoading && (
          <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>
        )}
        {isError && (
          <span className="text-xs text-red-500">Failed to load geo points.</span>
        )}
        {!isLoading && !isError && points.length > 0 && (
          <span className="text-xs text-muted-foreground">{points.length} points</span>
        )}
      </div>

      {/* Map + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="relative flex-1">
          {!campaignId ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Enter a campaign ID to display geo submissions.
            </div>
          ) : (
            <>
              <GeoMap points={points} />
              <Legend />
            </>
          )}
        </div>

        {/* Sidebar */}
        <aside className="w-56 border-s bg-card p-4 overflow-y-auto flex-shrink-0">
          <h2 className="text-sm font-semibold mb-3">Points by node</h2>
          <PointSidebar points={points} />
        </aside>
      </div>
    </div>
  );
}
