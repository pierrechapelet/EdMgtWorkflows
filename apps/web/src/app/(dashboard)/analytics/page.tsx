'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  useCampaignSummary,
  useCompletionRate,
  useOverdue,
  useTurnaround,
  useFillDuration,
} from '@/lib/api/hooks/use-reports';

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-5 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-3xl font-bold ${accent ?? ''}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Progress bar ───────────────────────────────────────────────────────────────

function ProgressBar({ pct, color = 'bg-blue-500' }: { pct: number; color?: string }) {
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div
        className={`${color} h-2 rounded-full transition-all`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

// ── Completion table ───────────────────────────────────────────────────────────

function CompletionTable({ campaignId }: { campaignId: string }) {
  const { data, isLoading } = useCompletionRate(campaignId);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data?.length) return <p className="text-sm text-muted-foreground">No data.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 font-medium">Node</th>
            <th className="pb-2 font-medium text-right">Total</th>
            <th className="pb-2 font-medium text-right">Submitted</th>
            <th className="pb-2 font-medium text-right">Approved</th>
            <th className="pb-2 font-medium w-40">Completion</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const name =
              typeof row.nodeName === 'object' && row.nodeName
                ? ((row.nodeName as Record<string, string>).en ?? row.nodeCode)
                : row.nodeCode;
            const color =
              row.completionPct >= 80
                ? 'bg-green-500'
                : row.completionPct >= 40
                  ? 'bg-yellow-400'
                  : 'bg-red-400';
            return (
              <tr key={row.nodeId} className="border-b last:border-0">
                <td className="py-2 font-medium">{name}</td>
                <td className="py-2 text-right">{row.total}</td>
                <td className="py-2 text-right">{row.submitted}</td>
                <td className="py-2 text-right text-green-600">{row.approved}</td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <ProgressBar pct={row.completionPct} color={color} />
                    <span className="text-xs w-10 text-right">{row.completionPct}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Overdue table ──────────────────────────────────────────────────────────────

function OverdueTable({ campaignId }: { campaignId: string }) {
  const { data, isLoading } = useOverdue(campaignId);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data?.length)
    return <p className="text-sm text-green-600">No overdue assignments.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 font-medium">Node</th>
            <th className="pb-2 font-medium text-right">Overdue</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const name =
              typeof row.nodeName === 'object' && row.nodeName
                ? ((row.nodeName as Record<string, string>).en ?? row.nodeCode)
                : row.nodeCode;
            return (
              <tr key={row.nodeId} className="border-b last:border-0">
                <td className="py-2 font-medium">{name}</td>
                <td className="py-2 text-right text-red-600 font-semibold">
                  {row.overdueCount}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Campaign selector ──────────────────────────────────────────────────────────

function CampaignInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium">Campaign ID</label>
      <input
        className="border rounded-md px-3 py-1.5 text-sm w-80 font-mono focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="Paste a campaign UUID…"
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
      />
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  const [campaignId, setCampaignId] = useState(searchParams.get('campaign') ?? '');

  const { data: summary, isLoading: summaryLoading } = useCampaignSummary(campaignId);
  const { data: turnaround } = useTurnaround(campaignId);
  const { data: fillDuration } = useFillDuration(campaignId);

  const title =
    summary?.campaign.title?.en ?? summary?.campaign.title?.fr ?? 'Campaign Analytics';

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">
            {campaignId ? title : 'Campaign Analytics'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Completion rates, overdue counts, turnaround times
          </p>
        </div>
        <CampaignInput value={campaignId} onChange={setCampaignId} />
      </div>

      {!campaignId && (
        <div className="rounded-lg border bg-muted/30 p-12 text-center text-muted-foreground">
          Enter a campaign ID above to load analytics.
        </div>
      )}

      {campaignId && summaryLoading && (
        <p className="text-sm text-muted-foreground">Loading summary…</p>
      )}

      {campaignId && summary && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Completion"
              value={`${summary.stats.completionPct}%`}
              sub={`${summary.stats.submitted} / ${summary.stats.total} submitted`}
              accent="text-blue-600"
            />
            <StatCard
              label="Approved"
              value={summary.stats.approved}
              accent="text-green-600"
            />
            <StatCard
              label="Overdue"
              value={summary.stats.overdue}
              accent={summary.stats.overdue > 0 ? 'text-red-600' : ''}
            />
            <StatCard
              label="Flagged"
              value={summary.stats.flagged}
              accent={summary.stats.flagged > 0 ? 'text-yellow-600' : ''}
            />
          </div>

          {/* Timing cards */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Avg Turnaround"
              value={turnaround?.avgHours != null ? `${turnaround.avgHours}h` : '—'}
              sub={
                turnaround?.sampleSize
                  ? `Based on ${turnaround.sampleSize} approved submissions`
                  : 'No approved submissions yet'
              }
            />
            <StatCard
              label="Avg Fill Duration"
              value={fillDuration?.avgMinutes != null ? `${fillDuration.avgMinutes}m` : '—'}
              sub={
                fillDuration?.sampleSize
                  ? `Based on ${fillDuration.sampleSize} submissions`
                  : 'No submissions yet'
              }
            />
          </div>

          {/* Completion by node */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-base font-semibold">Completion Rate by Node</h2>
            <CompletionTable campaignId={campaignId} />
          </div>

          {/* Overdue by node */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-base font-semibold">Overdue Assignments by Node</h2>
            <OverdueTable campaignId={campaignId} />
          </div>
        </>
      )}
    </div>
  );
}
