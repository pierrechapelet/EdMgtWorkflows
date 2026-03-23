'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export type NotificationType =
  | 'assignment_created'
  | 'deadline_approaching'
  | 'deadline_passed'
  | 'submission_received'
  | 'approved'
  | 'rejected'
  | 'campaign_recalled'
  | 'escalation_created';

export interface NotificationDef {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  emailSent: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  data: NotificationDef[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    unread: number;
  };
}

// ── Queries ────────────────────────────────────────────────────────────────

export function useNotifications(params?: { page?: number; limit?: number; unreadOnly?: boolean }) {
  const { page = 1, limit = 20, unreadOnly } = params ?? {};
  return useQuery({
    queryKey: ['notifications', page, limit, unreadOnly],
    queryFn: () =>
      apiClient
        .get<NotificationsResponse>('/notifications', {
          params: { page, limit, ...(unreadOnly && { unreadOnly: true }) },
        })
        .then((r) => r.data),
    refetchInterval: 30_000, // poll every 30s for new notifications
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () =>
      apiClient
        .get<{ count: number }>('/notifications/unread-count')
        .then((r) => r.data.count),
    refetchInterval: 30_000,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`/notifications/${id}/read`).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.patch('/notifications/read-all').then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });
}
