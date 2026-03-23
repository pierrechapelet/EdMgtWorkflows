'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface RoleDef {
  id: string;
  code: string;
  name: Record<string, string>;
  description?: Record<string, string>;
}

export function useRoles(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['roles', params],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: RoleDef[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>('/roles', { params: { limit: 200, ...params } });
      return res.data;
    },
  });
}

export function useRole(id: string) {
  return useQuery({
    queryKey: ['role', id],
    queryFn: async () => {
      const res = await apiClient.get<{ data: RoleDef }>(`/roles/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });
}
