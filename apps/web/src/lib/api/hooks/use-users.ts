'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface UserSummary {
  id: string;
  email: string;
  phone: string | null;
  preferredLang: string;
  mfaEnabled: boolean;
  createdAt: string;
}

export interface RoleAssignment {
  id: string;
  validFrom: string;
  validUntil: string | null;
  role: { id: string; code: string; name: Record<string, string> };
  xeduNode: { id: string; code: string; nodeType: string; name: Record<string, string> };
  grantedBy: { id: string; email: string };
}

export function useUsers(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: { data: UserSummary[]; meta: { total: number; page: number; limit: number; totalPages: number } };
      }>('/users', { params });
      return res.data.data;
    },
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: async () => {
      const res = await apiClient.get<{ data: UserSummary & { roleAssignments: RoleAssignment[] } }>(
        `/users/${id}`,
      );
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useUserRoles(userId: string) {
  return useQuery({
    queryKey: ['user-roles', userId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: RoleAssignment[] }>(`/users/${userId}/roles`);
      return res.data.data;
    },
    enabled: !!userId,
  });
}

export function useAssignRole(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { roleId: string; xeduNodeId: string; validFrom?: string; validUntil?: string }) =>
      apiClient.post(`/users/${userId}/roles`, data).then((r) => r.data.data as RoleAssignment),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-roles', userId] });
      void queryClient.invalidateQueries({ queryKey: ['user', userId] });
    },
  });
}

export function useRevokeRole(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) =>
      apiClient.delete(`/users/${userId}/roles/${assignmentId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-roles', userId] });
      void queryClient.invalidateQueries({ queryKey: ['user', userId] });
    },
  });
}
