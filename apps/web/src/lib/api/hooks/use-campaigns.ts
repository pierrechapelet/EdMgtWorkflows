'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'recalled' | 'closed';
export type AssignmentStatus =
  | 'pending'
  | 'in_progress'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'forwarded'
  | 'expired'
  | 'flagged';

export interface CampaignDef {
  id: string;
  title: Record<string, string>;
  status: CampaignStatus;
  globalDeadline: string | null;
  ownerNodeId: string;
  ownerNode?: { id: string; code: string; name: Record<string, string>; nodeType: string };
  formTemplateId: string;
  formTemplate?: { id: string; code: string; title: Record<string, string> };
  formVersionId: string;
  formVersion?: { id: string; versionNumber: number };
  workflowAssignments?: WorkflowAssignmentDef[];
  _count?: { workflowAssignments: number; submissionsAssignments: number };
  createdAt: string;
}

export interface WorkflowAssignmentDef {
  id: string;
  campaignId: string;
  targetNodeId: string;
  targetNode?: { id: string; code: string; name: Record<string, string>; nodeType: string };
  workflowId: string;
  workflow?: { id: string; name: Record<string, string>; isPublished: boolean; _count?: { steps: number } };
  deadlineOverride: string | null;
}

export interface AssignmentDef {
  id: string;
  campaignId: string;
  campaign?: {
    id: string;
    title: Record<string, string>;
    status: CampaignStatus;
    globalDeadline: string | null;
    formTemplate?: { id: string; code: string; title: Record<string, string> };
    formVersion?: { id: string; versionNumber: number; schema?: unknown };
  };
  workflowStepId: string;
  workflowStep?: { id: string; name: Record<string, string>; stepType: string };
  assignedTo: string;
  assignedUser?: { id: string; email: string };
  assignedNodeId: string;
  assignedNode?: { id: string; code: string; name: Record<string, string>; nodeType: string };
  status: AssignmentStatus;
  deadline: string | null;
  _count?: { submissions: number };
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

export function useCampaigns(params?: {
  ownerNodeId?: string;
  status?: CampaignStatus;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['campaigns', params],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: CampaignDef[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>('/campaigns', { params });
      return res.data;
    },
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: async () => {
      const res = await apiClient.get<{ data: CampaignDef }>(`/campaigns/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: Record<string, string>;
      formTemplateId: string;
      ownerNodeId: string;
      globalDeadline?: string;
    }) => apiClient.post('/campaigns', data).then((r) => r.data.data as CampaignDef),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function useUpdateCampaign(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title?: Record<string, string>; globalDeadline?: string }) =>
      apiClient.patch(`/campaigns/${id}`, data).then((r) => r.data.data as CampaignDef),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      void queryClient.invalidateQueries({ queryKey: ['campaign', id] });
    },
  });
}

function makeStatusMutation(id: string, action: string, qc: ReturnType<typeof useQueryClient>) {
  return () =>
    apiClient.post(`/campaigns/${id}/${action}`).then((r) => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
      void qc.invalidateQueries({ queryKey: ['campaign', id] });
      return r.data.data as CampaignDef;
    });
}

export function useActivateCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: makeStatusMutation(id, 'activate', qc) });
}
export function usePauseCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: makeStatusMutation(id, 'pause', qc) });
}
export function useRecallCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: makeStatusMutation(id, 'recall', qc) });
}
export function useCloseCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: makeStatusMutation(id, 'close', qc) });
}

// ── Workflow assignments ───────────────────────────────────────────────────────

export function useAssignWorkflow(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { targetNodeId: string; workflowId: string; deadlineOverride?: string }) =>
      apiClient
        .post(`/campaigns/${campaignId}/workflow-assignments`, data)
        .then((r) => r.data.data as WorkflowAssignmentDef),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['campaign', campaignId] }),
  });
}

export function useRemoveWorkflowAssignment(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) =>
      apiClient.delete(`/campaigns/${campaignId}/workflow-assignments/${assignmentId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['campaign', campaignId] }),
  });
}

// ── Assignments (admin campaign view) ─────────────────────────────────────────

export function useCampaignAssignments(
  campaignId: string,
  params?: { status?: AssignmentStatus; page?: number; limit?: number },
) {
  return useQuery({
    queryKey: ['campaign-assignments', campaignId, params],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: AssignmentDef[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>(`/campaigns/${campaignId}/assignments`, { params });
      return res.data;
    },
    enabled: !!campaignId,
  });
}

// ── My assignments (portal) ───────────────────────────────────────────────────

export function useMyAssignments(params?: {
  campaignId?: string;
  status?: AssignmentStatus;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['my-assignments', params],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: AssignmentDef[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>('/assignments', { params });
      return res.data;
    },
  });
}

export function useMyAssignment(id: string) {
  return useQuery({
    queryKey: ['my-assignment', id],
    queryFn: async () => {
      const res = await apiClient.get<{ data: AssignmentDef }>(`/assignments/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}
