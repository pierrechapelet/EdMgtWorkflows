'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type {
  WorkflowDefinitionDef,
  WorkflowStepDef,
  WorkflowTransitionDef,
  StepType,
  TriggerAction,
  NodeRelType,
} from '@/lib/workflow-designer/types';

// ── Definitions ───────────────────────────────────────────────────────────────

export function useWorkflows(params?: {
  ownerNodeId?: string;
  isPublished?: boolean;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['workflows', params],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: WorkflowDefinitionDef[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>('/workflows', { params });
      return res.data;
    },
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: ['workflow', id],
    queryFn: async () => {
      const res = await apiClient.get<{ data: WorkflowDefinitionDef }>(`/workflows/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useWorkflowGraph(id: string) {
  return useQuery({
    queryKey: ['workflow-graph', id],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: {
          nodes: unknown[];
          edges: unknown[];
          workflow: WorkflowDefinitionDef;
        };
      }>(`/workflows/${id}/graph`);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: Record<string, string>; ownerNodeId: string }) =>
      apiClient.post('/workflows', data).then((r) => r.data.data as WorkflowDefinitionDef),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

export function useUpdateWorkflow(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: Record<string, string> }) =>
      apiClient.patch(`/workflows/${id}`, data).then((r) => r.data.data as WorkflowDefinitionDef),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
      void queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
}

export function usePublishWorkflow(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post(`/workflows/${id}/publish`).then((r) => r.data.data as WorkflowDefinitionDef),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
      void queryClient.invalidateQueries({ queryKey: ['workflow', id] });
      void queryClient.invalidateQueries({ queryKey: ['workflow-graph', id] });
    },
  });
}

// ── Steps ─────────────────────────────────────────────────────────────────────

export function useCreateWorkflowStep(workflowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: Record<string, string>;
      stepType: StepType;
      orderIndex: number;
      assigneeRoleId?: string;
      assigneeNodeRel?: NodeRelType;
      deadlineOffsetHours?: number;
    }) =>
      apiClient
        .post(`/workflows/${workflowId}/steps`, data)
        .then((r) => r.data.data as WorkflowStepDef),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
      void queryClient.invalidateQueries({ queryKey: ['workflow-graph', workflowId] });
    },
  });
}

export function useUpdateWorkflowStep(workflowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stepId, ...data }: Partial<WorkflowStepDef> & { stepId: string }) =>
      apiClient
        .patch(`/workflows/${workflowId}/steps/${stepId}`, data)
        .then((r) => r.data.data as WorkflowStepDef),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
      void queryClient.invalidateQueries({ queryKey: ['workflow-graph', workflowId] });
    },
  });
}

export function useDeleteWorkflowStep(workflowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stepId: string) =>
      apiClient.delete(`/workflows/${workflowId}/steps/${stepId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
      void queryClient.invalidateQueries({ queryKey: ['workflow-graph', workflowId] });
    },
  });
}

// ── Transitions ───────────────────────────────────────────────────────────────

export function useCreateWorkflowTransition(workflowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      fromStepId: string;
      toStepId: string;
      triggerAction: TriggerAction;
      conditions?: Record<string, unknown>;
    }) =>
      apiClient
        .post(`/workflows/${workflowId}/transitions`, data)
        .then((r) => r.data.data as WorkflowTransitionDef),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
      void queryClient.invalidateQueries({ queryKey: ['workflow-graph', workflowId] });
    },
  });
}

export function useDeleteWorkflowTransition(workflowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transitionId: string) =>
      apiClient.delete(`/workflows/${workflowId}/transitions/${transitionId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
      void queryClient.invalidateQueries({ queryKey: ['workflow-graph', workflowId] });
    },
  });
}
