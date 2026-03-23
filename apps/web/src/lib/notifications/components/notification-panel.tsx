'use client';

import { useNotifications, useMarkNotificationRead, useMarkAllRead, type NotificationDef, type NotificationType } from '@/lib/api/hooks/use-notifications';

const TYPE_CONFIG: Record<
  NotificationType,
  { label: string; icon: string; colour: string }
> = {
  assignment_created:  { label: 'New assignment',     icon: '📋', colour: 'text-blue-600' },
  deadline_approaching:{ label: 'Deadline soon',      icon: '⏰', colour: 'text-yellow-600' },
  deadline_passed:     { label: 'Deadline passed',    icon: '🔴', colour: 'text-red-600' },
  submission_received: { label: 'Review needed',      icon: '📥', colour: 'text-purple-600' },
  approved:            { label: 'Approved',            icon: '✅', colour: 'text-green-600' },
  rejected:            { label: 'Rejected',            icon: '❌', colour: 'text-red-600' },
  campaign_recalled:   { label: 'Campaign recalled',  icon: '📢', colour: 'text-orange-600' },
  escalation_created:  { label: 'Escalated to you',   icon: '🔺', colour: 'text-red-600' },
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: NotificationDef;
  onMarkRead: (id: string) => void;
}) {
  const cfg = TYPE_CONFIG[notification.type] ?? {
    label: notification.type,
    icon: '🔔',
    colour: 'text-gray-600',
  };

  return (
    <div
      className={`flex gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
        notification.isRead ? 'hover:bg-gray-50' : 'bg-blue-50 hover:bg-blue-100'
      }`}
      onClick={() => {
        if (!notification.isRead) onMarkRead(notification.id);
      }}
    >
      <span className="text-xl shrink-0 mt-0.5">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-xs font-semibold uppercase tracking-wide ${cfg.colour}`}>
            {cfg.label}
          </p>
          <span className="text-xs text-gray-400 shrink-0">{formatRelative(notification.createdAt)}</span>
        </div>
        <p className="text-sm font-medium text-gray-900 mt-0.5 leading-snug">{notification.title}</p>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notification.body}</p>
      </div>
      {!notification.isRead && (
        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />
      )}
    </div>
  );
}

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { data, isLoading } = useNotifications({ limit: 30 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  const notifications = data?.data ?? [];
  const unread = data?.meta.unread ?? 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="font-semibold text-gray-900">Notifications</h2>
          {unread > 0 && (
            <p className="text-xs text-gray-500">{unread} unread</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button
              onClick={() => void markAll.mutateAsync()}
              disabled={markAll.isPending}
              className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-3xl mb-2">🔔</p>
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onMarkRead={(id) => void markRead.mutateAsync(id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
