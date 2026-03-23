'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type {
  FormTemplateDef,
  FormVersionDef,
  FormComponentDef,
} from '@/lib/form-builder/types';

// ── Templates ─────────────────────────────────────────────────────────────────

export function useFormTemplates(params?: {
  ownerNodeId?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['form-templates', params],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: FormTemplateDef[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>('/forms/templates', { params });
      return res.data;
    },
  });
}

export function useFormTemplate(id: string) {
  return useQuery({
    queryKey: ['form-template', id],
    queryFn: async () => {
      const res = await apiClient.get<{ data: FormTemplateDef }>(`/forms/templates/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useCreateFormTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { code: string; title: Record<string, string>; ownerNodeId: string }) =>
      apiClient.post('/forms/templates', data).then((r) => r.data.data as FormTemplateDef),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['form-templates'] });
    },
  });
}

export function useUpdateFormTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title?: Record<string, string>; currentVersionId?: string }) =>
      apiClient.patch(`/forms/templates/${id}`, data).then((r) => r.data.data as FormTemplateDef),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['form-templates'] });
      void queryClient.invalidateQueries({ queryKey: ['form-template', id] });
    },
  });
}

// ── Versions ──────────────────────────────────────────────────────────────────

export function useFormVersions(templateId: string) {
  return useQuery({
    queryKey: ['form-versions', templateId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: FormVersionDef[] }>(
        `/forms/templates/${templateId}/versions`,
      );
      return res.data.data;
    },
    enabled: !!templateId,
  });
}

export function useFormVersion(templateId: string, versionId: string) {
  return useQuery({
    queryKey: ['form-version', templateId, versionId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: FormVersionDef }>(
        `/forms/templates/${templateId}/versions/${versionId}`,
      );
      return res.data.data;
    },
    enabled: !!templateId && !!versionId,
  });
}

export function useCreateFormVersion(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data?: { isDraft?: boolean }) =>
      apiClient
        .post(`/forms/templates/${templateId}/versions`, data ?? {})
        .then((r) => r.data.data as FormVersionDef),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['form-versions', templateId] });
      void queryClient.invalidateQueries({ queryKey: ['form-template', templateId] });
    },
  });
}

export function usePublishFormVersion(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) =>
      apiClient
        .post(`/forms/templates/${templateId}/versions/${versionId}/publish`)
        .then((r) => r.data.data as FormVersionDef),
    onSuccess: (_data, versionId) => {
      void queryClient.invalidateQueries({ queryKey: ['form-versions', templateId] });
      void queryClient.invalidateQueries({ queryKey: ['form-version', templateId, versionId] });
      void queryClient.invalidateQueries({ queryKey: ['form-template', templateId] });
    },
  });
}

// ── Components ────────────────────────────────────────────────────────────────

export function useCreateFormComponent(templateId: string, versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<FormComponentDef, 'id' | 'children'>) =>
      apiClient
        .post(`/forms/templates/${templateId}/versions/${versionId}/components`, data)
        .then((r) => r.data.data as FormComponentDef),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['form-version', templateId, versionId] });
    },
  });
}

export function useUpdateFormComponent(templateId: string, versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<FormComponentDef> & { id: string }) =>
      apiClient
        .patch(`/forms/templates/${templateId}/versions/${versionId}/components/${id}`, data)
        .then((r) => r.data.data as FormComponentDef),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['form-version', templateId, versionId] });
    },
  });
}

export function useDeleteFormComponent(templateId: string, versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (componentId: string) =>
      apiClient.delete(
        `/forms/templates/${templateId}/versions/${versionId}/components/${componentId}`,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['form-version', templateId, versionId] });
    },
  });
}

export function useReorderFormComponents(templateId: string, versionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiClient
        .put(`/forms/templates/${templateId}/versions/${versionId}/components/reorder`, {
          orderedIds,
        })
        .then((r) => r.data.data as FormVersionDef),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['form-version', templateId, versionId] });
    },
  });
}
