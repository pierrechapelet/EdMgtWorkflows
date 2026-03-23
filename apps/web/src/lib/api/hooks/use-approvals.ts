'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export type ApprovalAction = 'approve' | 'reject' | 'forward' | 'request_correction';

export interface ApprovalEventDef {
  id: string;
  submissionId: string;
  assignmentId: string;
  workflowStepId: string;
  actorId: string;
  action: ApprovalAction;
  comment: string | null;
  createdAt: string;
  actor: { id: string; email: string };
  workflowStep: { id: string; name: unknown; stepType: string };
}

export interface TakeActionDto {
  action: ApprovalAction;
  comment?: string;
}

export interface TakeActionResult {
  event: ApprovalEventDef;
  nextAssignmentId: string | null;
}

export interface FlaggedSubmissionDef {
  id: string;
  assignmentId: string;
  status: string;
  conflictReason: string | null;
  submittedAt: string | null;
  createdAt: string;
  formVersion: { id: string; versionNumber: number };
  assignment: {
    assignedUser: { id: string; email: string };
    assignedNode: { id: string; code: string; name: unknown };
    campaign: {
      title: unknown;
      formTemplate: { code: string; title: unknown };
    };
  } | null;
}

// ── Take action ─────────────────────────────────────────────────────────────

export function useTakeApprovalAction(assignmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: TakeActionDto) =>
      apiClient
        .post<{ data: TakeActionResult }>(`/approvals/${assignmentId}/action`, dto)
        .then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignment', assignmentId] });
      qc.invalidateQueries({ queryKey: ['my-assignments'] });
      qc.invalidateQueries({ queryKey: ['approval-history'] });
    },
  });
}

// ── History ──────────────────────────────────────────────────────────────────

export function useSubmissionHistory(submissionId: string | undefined) {
  return useQuery({
    queryKey: ['approval-history', 'submission', submissionId],
    queryFn: () =>
      apiClient
        .get<{ data: ApprovalEventDef[] }>(`/approvals/submission/${submissionId}/history`)
        .then((r) => r.data.data),
    enabled: !!submissionId,
  });
}

export function useAssignmentHistory(assignmentId: string | undefined) {
  return useQuery({
    queryKey: ['approval-history', 'assignment', assignmentId],
    queryFn: () =>
      apiClient
        .get<{ data: ApprovalEventDef[] }>(`/approvals/assignment/${assignmentId}/history`)
        .then((r) => r.data.data),
    enabled: !!assignmentId,
  });
}

// ── Flagged submissions ───────────────────────────────────────────────────────

export function useFlaggedSubmissions(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['flagged-submissions', page, limit],
    queryFn: () =>
      apiClient
        .get<{
          data: FlaggedSubmissionDef[];
          meta: { total: number; page: number; limit: number; totalPages: number };
        }>('/approvals/flagged', { params: { page, limit } })
        .then((r) => r.data),
  });
}
