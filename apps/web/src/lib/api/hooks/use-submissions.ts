'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { FieldValues } from '@/lib/form-renderer/types';
import type { SignatureValue } from '@/lib/signature/components/signature-pad';

export interface SubmissionValueDef {
  id: string;
  submissionId: string;
  componentId: string;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: string | null;
  valueJson: unknown;
  valueFileKey: string | null;
}

export interface SubmissionDef {
  id: string;
  assignmentId: string;
  formVersionId: string;
  submittedBy: string;
  status: 'draft' | 'submitted' | 'flagged';
  offlineFlag: boolean;
  conflictReason: string | null;
  signatureHash: string | null;
  submittedAt: string | null;
  createdAt: string;
  values: SubmissionValueDef[];
  formVersion?: { id: string; versionNumber: number; schema?: unknown };
}

// Convert FieldValues map → array of SubmissionValueDto
function flattenValues(values: FieldValues) {
  return Object.entries(values).map(([componentId, val]) => {
    if (val === null || val === undefined) return { componentId };

    if (typeof val === 'string') return { componentId, valueText: val };
    if (typeof val === 'number') return { componentId, valueNumber: val };
    if (Array.isArray(val)) return { componentId, valueJson: { items: val } };
    if (typeof val === 'object') {
      // GeoValue, TableRow[], SignatureValue — store as JSON
      if ('lat' in (val as object)) {
        return { componentId, valueJson: val as Record<string, unknown> };
      }
      return { componentId, valueJson: val as Record<string, unknown> };
    }
    return { componentId, valueText: String(val) };
  });
}

// Convert submission values back to FieldValues map
export function inflateValues(serverValues: SubmissionValueDef[]): FieldValues {
  const map: FieldValues = {};
  for (const v of serverValues) {
    if (v.valueNumber !== null) { map[v.componentId] = v.valueNumber; continue; }
    if (v.valueDate !== null) { map[v.componentId] = v.valueDate; continue; }
    if (v.valueFileKey !== null) { map[v.componentId] = v.valueFileKey; continue; }
    if (v.valueJson !== null && v.valueJson !== undefined) {
      const j = v.valueJson as Record<string, unknown>;
      if ('items' in j && Array.isArray(j.items)) { map[v.componentId] = j.items as string[]; continue; }
      map[v.componentId] = v.valueJson as FieldValues[string];
      continue;
    }
    map[v.componentId] = v.valueText ?? undefined;
  }
  return map;
}

export function useSubmission(id: string) {
  return useQuery({
    queryKey: ['submission', id],
    queryFn: async () => {
      const res = await apiClient.get<{ data: SubmissionDef }>(`/submissions/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useDraft(assignmentId: string) {
  return useQuery({
    queryKey: ['draft', assignmentId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: SubmissionDef }>(
        `/submissions/draft/${assignmentId}`,
      );
      return res.data.data;
    },
    enabled: !!assignmentId,
  });
}

export function useSaveDraft(assignmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: FieldValues) =>
      apiClient
        .post(`/submissions/draft/${assignmentId}`, { values: flattenValues(values) })
        .then((r) => r.data.data as SubmissionDef),
    onSuccess: (data) => {
      qc.setQueryData(['draft', assignmentId], data);
    },
  });
}

export function useSubmitSubmission(assignmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      values,
      signature,
    }: {
      values: FieldValues;
      signature?: SignatureValue | null;
    }) =>
      apiClient
        .post(`/submissions/submit/${assignmentId}`, {
          values: flattenValues(values),
          signatureImageBase64: signature?.imageBase64,
          signatureTypedName: signature?.typedName,
        })
        .then((r) => r.data.data as SubmissionDef),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-assignments'] });
      void qc.invalidateQueries({ queryKey: ['my-assignment', assignmentId] });
      void qc.invalidateQueries({ queryKey: ['draft', assignmentId] });
    },
  });
}

export function useSubmissionByAssignment(assignmentId: string | undefined) {
  return useQuery({
    queryKey: ['submission-by-assignment', assignmentId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: SubmissionDef[] }>(
        `/submissions/by-assignment/${assignmentId}`,
      );
      // Return the most recent submission (submitted > draft)
      const list = res.data.data ?? [];
      return (
        list.find((s) => s.status === 'submitted') ??
        list.find((s) => s.status === 'flagged') ??
        list[0] ??
        null
      );
    },
    enabled: !!assignmentId,
  });
}

export function useRequestUploadUrl() {
  return useMutation({
    mutationFn: (data: {
      assignmentId: string;
      componentId: string;
      filename: string;
      contentType: string;
      sizeBytes?: number;
    }) =>
      apiClient
        .post('/submissions/upload-url', data)
        .then((r) => r.data.data as { uploadUrl: string; key: string }),
  });
}
