'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface XeduNode {
  id: string;
  code: string;
  nodeType: string;
  name: Record<string, string>;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
}

export interface XeduEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: string;
  fromNode: Pick<XeduNode, 'id' | 'code' | 'name' | 'nodeType'>;
  toNode: Pick<XeduNode, 'id' | 'code' | 'name' | 'nodeType'>;
  createdAt: string;
}

interface NodesResponse {
  data: XeduNode[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function useXeduNodes(params?: {
  page?: number;
  limit?: number;
  nodeType?: string;
  isActive?: boolean;
  search?: string;
}) {
  return useQuery({
    queryKey: ['xedu-nodes', params],
    queryFn: async () => {
      const res = await apiClient.get<{ data: NodesResponse }>('/xedu/nodes', {
        params,
      });
      return res.data.data;
    },
  });
}

export function useXeduNode(id: string) {
  return useQuery({
    queryKey: ['xedu-node', id],
    queryFn: async () => {
      const res = await apiClient.get<{ data: XeduNode & { fromEdges: XeduEdge[]; toEdges: XeduEdge[] } }>(
        `/xedu/nodes/${id}`,
      );
      return res.data.data;
    },
    enabled: !!id,
  });
}

export function useNodeDescendants(nodeId: string) {
  return useQuery({
    queryKey: ['xedu-descendants', nodeId],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Array<XeduNode & { depth: number }> }>(
        `/xedu/nodes/${nodeId}/descendants`,
      );
      return res.data.data;
    },
    enabled: !!nodeId,
  });
}

export function useCreateXeduNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { nodeType: string; name: Record<string, string>; metadata?: Record<string, unknown> }) =>
      apiClient.post('/xedu/nodes', data).then((r) => r.data.data as XeduNode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['xedu-nodes'] });
    },
  });
}

export function useUpdateXeduNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: Record<string, string>; isActive?: boolean }) =>
      apiClient.patch(`/xedu/nodes/${id}`, data).then((r) => r.data.data as XeduNode),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['xedu-nodes'] });
      void queryClient.invalidateQueries({ queryKey: ['xedu-node', variables.id] });
    },
  });
}

export function useCreateXeduEdge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { fromNodeId: string; toNodeId: string; edgeType: string }) =>
      apiClient.post('/xedu/edges', data).then((r) => r.data.data as XeduEdge),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['xedu-nodes'] });
      void queryClient.invalidateQueries({ queryKey: ['xedu-node'] });
    },
  });
}

export function useDeleteXeduEdge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/xedu/edges/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['xedu-nodes'] });
      void queryClient.invalidateQueries({ queryKey: ['xedu-node'] });
    },
  });
}
