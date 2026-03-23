'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000' });

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CampaignStats {
  total: number;
  submitted: number;
  approved: number;
  rejected: number;
  overdue: number;
  flagged: number;
  pending: number;
  completionPct: number;
}

export interface CampaignSummary {
  campaign: {
    id: string;
    title: Record<string, string>;
    status: string;
    globalDeadline: string | null;
  };
  stats: CampaignStats;
}

export interface CompletionRow {
  nodeId: string;
  nodeCode: string;
  nodeName: Record<string, string>;
  total: number;
  submitted: number;
  approved: number;
  completionPct: number;
}

export interface OverdueRow {
  nodeId: string;
  nodeCode: string;
  nodeName: Record<string, string>;
  overdueCount: number;
}

export interface TurnaroundResult {
  campaignId: string;
  avgHours: number | null;
  sampleSize: number;
}

export interface FillDurationResult {
  campaignId: string;
  avgMinutes: number | null;
  sampleSize: number;
}

export interface GeoPoint {
  id: string;
  submissionId: string;
  assignmentId: string;
  componentId: string;
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  captureMethod: 'gps' | 'map_selection';
  capturedAt: string;
  nodeId: string;
  nodeCode: string;
}

export interface PdfJobStatus {
  jobId: string;
  status: string;
  downloadUrl: string | null;
  failedReason: string | null;
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

function base(campaignId: string) {
  return `/reports/campaigns/${campaignId}`;
}

export function useCampaignSummary(campaignId: string) {
  return useQuery<CampaignSummary>({
    queryKey: ['reports', campaignId, 'summary'],
    queryFn: () => api.get(`${base(campaignId)}/summary`).then((r) => r.data.data),
    enabled: !!campaignId,
  });
}

export function useCompletionRate(campaignId: string, nodeId?: string) {
  return useQuery<CompletionRow[]>({
    queryKey: ['reports', campaignId, 'completion', nodeId],
    queryFn: () =>
      api
        .get(`${base(campaignId)}/completion`, { params: nodeId ? { nodeId } : undefined })
        .then((r) => r.data.data),
    enabled: !!campaignId,
  });
}

export function useOverdue(campaignId: string, nodeId?: string) {
  return useQuery<OverdueRow[]>({
    queryKey: ['reports', campaignId, 'overdue', nodeId],
    queryFn: () =>
      api
        .get(`${base(campaignId)}/overdue`, { params: nodeId ? { nodeId } : undefined })
        .then((r) => r.data.data),
    enabled: !!campaignId,
  });
}

export function useTurnaround(campaignId: string) {
  return useQuery<TurnaroundResult>({
    queryKey: ['reports', campaignId, 'turnaround'],
    queryFn: () => api.get(`${base(campaignId)}/turnaround`).then((r) => r.data.data),
    enabled: !!campaignId,
  });
}

export function useFillDuration(campaignId: string) {
  return useQuery<FillDurationResult>({
    queryKey: ['reports', campaignId, 'fill-duration'],
    queryFn: () => api.get(`${base(campaignId)}/fill-duration`).then((r) => r.data.data),
    enabled: !!campaignId,
  });
}

export function useGeoPoints(campaignId: string, bbox?: string) {
  return useQuery<GeoPoint[]>({
    queryKey: ['reports', campaignId, 'geo', bbox],
    queryFn: () =>
      api
        .get(`${base(campaignId)}/geo`, { params: bbox ? { bbox } : undefined })
        .then((r) => r.data.data),
    enabled: !!campaignId,
  });
}

/** Triggers a browser download of the CSV or XLSX export */
export function useExportDownload() {
  const download = async (campaignId: string, format: 'csv' | 'xlsx') => {
    const response = await api.get(`${base(campaignId)}/export`, {
      params: { format },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a');
    const disposition = response.headers['content-disposition'] as string | undefined;
    const match = disposition?.match(/filename="?([^"]+)"?/);
    a.href = url;
    a.download = match?.[1] ?? `export.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  return { download };
}

/** Enqueues an async PDF export; returns { jobId } */
export function useEnqueuePdf(campaignId: string) {
  return useMutation<{ jobId: string; status: string }, Error>({
    mutationFn: () => api.post(`${base(campaignId)}/export/pdf`).then((r) => r.data.data),
  });
}

/** Polls a PDF job for status */
export function usePdfJobStatus(campaignId: string, jobId: string | null) {
  return useQuery<PdfJobStatus>({
    queryKey: ['reports', campaignId, 'pdf-job', jobId],
    queryFn: () =>
      api.get(`${base(campaignId)}/export/pdf/${jobId!}`).then((r) => r.data.data),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed' || status === 'not_found') return false;
      return 3000;
    },
  });
}
