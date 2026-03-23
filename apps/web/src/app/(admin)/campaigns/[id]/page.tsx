'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  useCampaign,
  useActivateCampaign,
  usePauseCampaign,
  useRecallCampaign,
  useCloseCampaign,
  useAssignWorkflow,
  useRemoveWorkflowAssignment,
  useCampaignAssignments,
  type CampaignStatus,
  type AssignmentStatus,
} from '@/lib/api/hooks/use-campaigns';
import { useXeduNodes } from '@/lib/api/hooks/use-xedu';
import { useWorkflows } from '@/lib/api/hooks/use-workflows';

const STATUS_BADGE: Record<CampaignStatus, { label: string; classes: string }> = {
  draft: { label: 'Draft', classes: 'bg-gray-100 text-gray-700' },
  active: { label: 'Active', classes: 'bg-green-100 text-green-700' },
  paused: { label: 'Paused', classes: 'bg-yellow-100 text-yellow-700' },
  recalled: { label: 'Recalled', classes: 'bg-red-100 text-red-700' },
  closed: { label: 'Closed', classes: 'bg-slate-100 text-slate-600' },
};

const ASSIGNMENT_STATUS_BADGE: Record<AssignmentStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  submitted: 'bg-purple-100 text-purple-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  forwarded: 'bg-orange-100 text-orange-700',
  expired: 'bg-slate-100 text-slate-500',
  flagged: 'bg-yellow-100 text-yellow-700',
};

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: campaign, isLoading, isError } = useCampaign(id);
  const { data: nodesData } = useXeduNodes({ limit: 200 });
  const { data: workflowsData } = useWorkflows({ isPublished: true, limit: 200 });

  const activate = useActivateCampaign(id);
  const pause = usePauseCampaign(id);
  const recall = useRecallCampaign(id);
  const close = useCloseCampaign(id);
  const assignWorkflow = useAssignWorkflow(id);
  const removeWorkflowAssignment = useRemoveWorkflowAssignment(id);

  const [assignPage, setAssignPage] = useState(1);
  const { data: assignments } = useCampaignAssignments(id, { page: assignPage, limit: 20 });

  const [showAssignForm, setShowAssignForm] = useState(false);
  const [newTargetNodeId, setNewTargetNodeId] = useState('');
  const [newWorkflowId, setNewWorkflowId] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleStatusAction(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Action failed';
      setActionError(msg);
    }
  }

  async function handleAssignWorkflow() {
    if (!newTargetNodeId || !newWorkflowId) return;
    setActionError(null);
    try {
      await assignWorkflow.mutateAsync({
        targetNodeId: newTargetNodeId,
        workflowId: newWorkflowId,
        deadlineOverride: newDeadline || undefined,
      });
      setNewTargetNodeId('');
      setNewWorkflowId('');
      setNewDeadline('');
      setShowAssignForm(false);
    } catch {
      setActionError('Failed to assign workflow');
    }
  }

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (isError || !campaign) return <div className="p-8 text-sm text-destructive">Failed to load campaign</div>;

  const titleEn = (campaign.title as Record<string, string>).en;
  const badge = STATUS_BADGE[campaign.status];
  const isDraft = campaign.status === 'draft';

  return (
    <div className="p-8 space-y-6">
      {/* Breadcrumb */}
      <div className="text-xs text-muted-foreground">
        <Link href="/admin/campaigns" className="hover:underline">Campaigns</Link>
        {' / '}
        <span>{titleEn}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{titleEn}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.classes}`}>
              {badge.label}
            </span>
          </div>
          {campaign.formTemplate && (
            <p className="text-sm text-muted-foreground">
              Form: [{campaign.formTemplate.code}] {(campaign.formTemplate.title as Record<string, string>).en}
              {campaign.formVersion && ` — v${campaign.formVersion.versionNumber}`}
            </p>
          )}
          {campaign.globalDeadline && (
            <p className="text-sm text-muted-foreground">
              Global deadline: {new Date(campaign.globalDeadline).toLocaleString()}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 shrink-0">
          {campaign.status === 'draft' && (
            <button
              onClick={() => void handleStatusAction(() => activate.mutateAsync())}
              disabled={activate.isPending}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {activate.isPending ? 'Activating…' : 'Activate'}
            </button>
          )}
          {campaign.status === 'active' && (
            <>
              <button
                onClick={() => void handleStatusAction(() => pause.mutateAsync())}
                disabled={pause.isPending}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                Pause
              </button>
              <button
                onClick={() => void handleStatusAction(() => recall.mutateAsync())}
                disabled={recall.isPending}
                className="rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50"
              >
                Recall
              </button>
            </>
          )}
          {campaign.status === 'paused' && (
            <button
              onClick={() => void handleStatusAction(() => activate.mutateAsync())}
              disabled={activate.isPending}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Resume
            </button>
          )}
          {['active', 'paused', 'recalled'].includes(campaign.status) && (
            <button
              onClick={() => void handleStatusAction(() => close.mutateAsync())}
              disabled={close.isPending}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {/* Workflow assignments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Workflow assignments ({campaign.workflowAssignments?.length ?? 0})
          </h2>
          {isDraft && (
            <button
              onClick={() => setShowAssignForm(!showAssignForm)}
              className="text-xs text-primary hover:underline"
            >
              {showAssignForm ? 'Cancel' : '+ Assign workflow'}
            </button>
          )}
        </div>

        {showAssignForm && (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Target node *</label>
                <select
                  value={newTargetNodeId}
                  onChange={(e) => setNewTargetNodeId(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select node…</option>
                  {nodesData?.data.map((n) => (
                    <option key={n.id} value={n.id}>
                      [{n.code}] {(n.name as Record<string, string>).en} ({n.nodeType})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Workflow (published) *</label>
                <select
                  value={newWorkflowId}
                  onChange={(e) => setNewWorkflowId(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select workflow…</option>
                  {workflowsData?.data.map((w) => (
                    <option key={w.id} value={w.id}>
                      {(w.name as Record<string, string>).en}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Deadline override</label>
                <input
                  type="datetime-local"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              onClick={() => void handleAssignWorkflow()}
              disabled={!newTargetNodeId || !newWorkflowId || assignWorkflow.isPending}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {assignWorkflow.isPending ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        )}

        {campaign.workflowAssignments?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workflow assignments yet.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {campaign.workflowAssignments?.map((wa) => (
              <div key={wa.id} className="flex items-center justify-between px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {wa.targetNode
                      ? `[${wa.targetNode.code}] ${(wa.targetNode.name as Record<string, string>).en}`
                      : wa.targetNodeId}
                    <span className="ms-1 text-xs text-muted-foreground">
                      ({wa.targetNode?.nodeType})
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Workflow: {wa.workflow ? (wa.workflow.name as Record<string, string>).en : wa.workflowId}
                    {wa.deadlineOverride && ` — deadline: ${new Date(wa.deadlineOverride).toLocaleDateString()}`}
                  </p>
                </div>
                {isDraft && (
                  <button
                    onClick={() => void removeWorkflowAssignment.mutateAsync(wa.id)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submissions assignments */}
      {!isDraft && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">
            Assignments ({assignments?.meta.total ?? 0})
          </h2>
          <div className="rounded-lg border">
            {!assignments ? (
              <div className="p-6 text-sm text-muted-foreground text-center">Loading…</div>
            ) : assignments.data.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center">No assignments</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-start font-medium">User</th>
                    <th className="px-4 py-3 text-start font-medium">Node</th>
                    <th className="px-4 py-3 text-start font-medium">Step</th>
                    <th className="px-4 py-3 text-start font-medium">Status</th>
                    <th className="px-4 py-3 text-start font-medium">Deadline</th>
                    <th className="px-4 py-3 text-start font-medium">Submissions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {assignments.data.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/25">
                      <td className="px-4 py-3 text-xs">{a.assignedUser?.email ?? a.assignedTo}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {a.assignedNode ? `[${a.assignedNode.code}] ${(a.assignedNode.name as Record<string, string>).en}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {a.workflowStep
                          ? `${(a.workflowStep.name as Record<string, string>).en} (${a.workflowStep.stepType})`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ASSIGNMENT_STATUS_BADGE[a.status]}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {a.deadline ? new Date(a.deadline).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground text-center">
                        {a._count?.submissions ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {assignments && assignments.meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  Page {assignments.meta.page} of {assignments.meta.totalPages}
                </span>
                <div className="flex gap-2">
                  <button disabled={assignPage === 1} onClick={() => setAssignPage((p) => p - 1)} className="rounded border px-3 py-1 text-xs disabled:opacity-40">Previous</button>
                  <button disabled={assignPage >= assignments.meta.totalPages} onClick={() => setAssignPage((p) => p + 1)} className="rounded border px-3 py-1 text-xs disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
