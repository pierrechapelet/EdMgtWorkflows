'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMyAssignments, type AssignmentStatus } from '@/lib/api/hooks/use-campaigns';

const STATUS_CONFIG: Record<
  AssignmentStatus,
  { label: string; badge: string; priority: number }
> = {
  pending: { label: 'Pending', badge: 'bg-yellow-100 text-yellow-700', priority: 1 },
  in_progress: { label: 'In progress', badge: 'bg-blue-100 text-blue-700', priority: 2 },
  submitted: { label: 'Submitted', badge: 'bg-purple-100 text-purple-700', priority: 3 },
  approved: { label: 'Approved', badge: 'bg-green-100 text-green-700', priority: 4 },
  rejected: { label: 'Rejected', badge: 'bg-red-100 text-red-700', priority: 5 },
  forwarded: { label: 'Forwarded', badge: 'bg-orange-100 text-orange-700', priority: 6 },
  expired: { label: 'Expired', badge: 'bg-slate-100 text-slate-500', priority: 7 },
  flagged: { label: 'Flagged', badge: 'bg-yellow-100 text-yellow-800 font-semibold', priority: 8 },
};

const FILTER_GROUPS = [
  { label: 'Active', statuses: ['pending', 'in_progress'] as AssignmentStatus[] },
  { label: 'Completed', statuses: ['submitted', 'approved', 'rejected', 'forwarded'] as AssignmentStatus[] },
  { label: 'Issues', statuses: ['expired', 'flagged'] as AssignmentStatus[] },
];

export default function MyAssignmentsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | undefined>();

  const { data, isLoading, isError } = useMyAssignments({
    status: statusFilter,
    page,
    limit: 20,
  });

  function isOverdue(deadline: string | null): boolean {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">My Assignments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Forms assigned to you — fill, review, or approve
        </p>
      </div>

      {/* Quick filter */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => { setStatusFilter(undefined); setPage(1); }}
          className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
            statusFilter === undefined
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent'
          }`}
        >
          All
        </button>
        {FILTER_GROUPS.map((g) => (
          <div key={g.label} className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{g.label}:</span>
            {g.statuses.map((s) => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`text-xs px-2 py-1 rounded-md transition-colors ${
                  statusFilter === s
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Assignment cards */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : isError ? (
        <div className="text-sm text-destructive">Failed to load assignments</div>
      ) : data?.data.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <p className="text-muted-foreground">No assignments found</p>
          {statusFilter && (
            <button
              onClick={() => setStatusFilter(undefined)}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Clear filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {data?.data.map((assignment) => {
            const statusCfg = STATUS_CONFIG[assignment.status];
            const overdue = isOverdue(assignment.deadline) && ['pending', 'in_progress'].includes(assignment.status);
            const canAct = ['pending', 'in_progress'].includes(assignment.status) &&
              assignment.campaign?.status === 'active';

            const titleEn = assignment.campaign?.title
              ? (assignment.campaign.title as Record<string, string>).en
              : 'Unknown campaign';

            const stepName = assignment.workflowStep?.name
              ? (assignment.workflowStep.name as Record<string, string>).en
              : assignment.workflowStep?.stepType ?? '—';

            const nodeName = assignment.assignedNode
              ? `[${assignment.assignedNode.code}] ${(assignment.assignedNode.name as Record<string, string>).en}`
              : '—';

            return (
              <div
                key={assignment.id}
                className={`rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm ${
                  overdue ? 'border-destructive/40' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-sm">{titleEn}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${statusCfg.badge}`}>
                        {statusCfg.label}
                      </span>
                      {overdue && (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive font-medium">
                          Overdue
                        </span>
                      )}
                      {assignment.campaign?.status === 'recalled' && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                          Campaign recalled
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span>Step: <strong className="text-foreground">{stepName}</strong></span>
                      <span>Node: {nodeName}</span>
                      {assignment.campaign?.formTemplate && (
                        <span>
                          Form: {(assignment.campaign.formTemplate.title as Record<string, string>).en}
                          {assignment.campaign.formVersion &&
                            ` v${assignment.campaign.formVersion.versionNumber}`}
                        </span>
                      )}
                    </div>

                    {assignment.deadline && (
                      <p className={`text-xs ${overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                        Deadline: {new Date(assignment.deadline).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {canAct && (
                    <Link
                      href={`/portal/assignments/${assignment.id}/fill`}
                      className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      {assignment.status === 'pending' ? 'Start' : 'Continue'}
                      {' '}→
                    </Link>
                  )}
                  {assignment.status === 'submitted' && (
                    <Link
                      href={`/portal/assignments/${assignment.id}`}
                      className="shrink-0 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
                    >
                      View
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {data.meta.total} assignment{data.meta.total !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border px-3 py-1 text-xs disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={page >= data.meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border px-3 py-1 text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
