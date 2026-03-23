'use client';

import React, { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMyAssignment } from '@/lib/api/hooks/use-campaigns';
import { useSubmissionByAssignment, inflateValues } from '@/lib/api/hooks/use-submissions';
import {
  useTakeApprovalAction,
  useAssignmentHistory,
  type ApprovalAction,
} from '@/lib/api/hooks/use-approvals';
import type { RendererComponent } from '@/lib/form-renderer/types';

const ACTION_LABELS: Record<ApprovalAction, string> = {
  approve: 'Approve',
  reject: 'Reject',
  forward: 'Forward',
  request_correction: 'Request Correction',
};

const ACTION_COLOURS: Record<ApprovalAction, string> = {
  approve: 'bg-green-600 hover:bg-green-700 text-white',
  reject: 'bg-red-600 hover:bg-red-700 text-white',
  forward: 'bg-blue-600 hover:bg-blue-700 text-white',
  request_correction: 'bg-yellow-500 hover:bg-yellow-600 text-white',
};

function stepTypeBadge(stepType: string) {
  const colours: Record<string, string> = {
    fill: 'bg-slate-100 text-slate-700',
    review: 'bg-purple-100 text-purple-700',
    approve: 'bg-green-100 text-green-700',
    reject: 'bg-red-100 text-red-700',
    forward: 'bg-blue-100 text-blue-700',
    notify: 'bg-yellow-100 text-yellow-700',
    end: 'bg-gray-100 text-gray-600',
  };
  return colours[stepType] ?? 'bg-gray-100 text-gray-600';
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function ValueDisplay({ component, value }: { component: RendererComponent; value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-400 italic">—</span>;
  }

  switch (component.type) {
    case 'file_upload': {
      const key = String(value);
      return (
        <a
          href={`/api/files/${encodeURIComponent(key)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline text-sm"
        >
          {key.split('/').pop()}
        </a>
      );
    }
    case 'signature': {
      const sig = value as { mode?: string; typedName?: string; imageBase64?: string };
      return (
        <div className="flex flex-col gap-1">
          {sig.mode === 'typed' && sig.typedName ? (
            <span className="font-serif italic text-lg">{sig.typedName}</span>
          ) : sig.imageBase64 ? (
            <img
              src={`data:image/png;base64,${sig.imageBase64}`}
              alt="Signature"
              className="border rounded max-h-24 max-w-xs object-contain"
            />
          ) : (
            <span className="text-gray-400 italic">Empty signature</span>
          )}
          <span className="text-xs text-gray-400">{sig.mode === 'typed' ? 'Typed' : 'Drawn'}</span>
        </div>
      );
    }
    case 'geo_coordinates': {
      const geo = value as { lat?: number; lng?: number; accuracy?: number };
      if (geo.lat !== undefined) {
        return (
          <span className="text-sm font-mono">
            {geo.lat.toFixed(6)}, {geo.lng?.toFixed(6)}
            {geo.accuracy != null && (
              <span className="text-gray-400 ml-1">(±{Math.round(geo.accuracy)}m)</span>
            )}
          </span>
        );
      }
      return <span className="text-sm">{JSON.stringify(value)}</span>;
    }
    case 'table': {
      const rows = value as Record<string, unknown>[];
      const cols = component.tableSchema?.columns ?? [];
      if (!rows || rows.length === 0) return <span className="text-gray-400 italic">No rows</span>;
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse border border-gray-200">
            <thead>
              <tr>
                {cols.map((col) => (
                  <th
                    key={col.key}
                    className="border border-gray-200 bg-gray-50 px-2 py-1 text-left font-medium"
                  >
                    {col.label?.en ?? col.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {cols.map((col) => (
                    <td key={col.key} className="border border-gray-200 px-2 py-1">
                      {String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case 'multi_select': {
      const items = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-1">
          {items.map((v) => (
            <span key={v} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">
              {v}
            </span>
          ))}
        </div>
      );
    }
    case 'date':
    case 'datetime':
      return <span>{formatDateTime(String(value))}</span>;
    default:
      return <span className="text-sm">{String(value)}</span>;
  }
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: assignmentId } = use(params);
  const router = useRouter();

  const { data: assignment, isLoading: assignmentLoading } = useMyAssignment(assignmentId);
  const { data: submission, isLoading: submissionLoading } = useSubmissionByAssignment(assignmentId);
  const { data: history } = useAssignmentHistory(assignmentId);
  const takeAction = useTakeApprovalAction(assignmentId);

  const [selectedAction, setSelectedAction] = useState<ApprovalAction | null>(null);
  const [comment, setComment] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState(false);

  const isLoading = assignmentLoading || submissionLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <p className="text-red-600 font-medium">Assignment not found.</p>
        <Link href="/assignments" className="text-blue-600 underline mt-4 block">
          Back to assignments
        </Link>
      </div>
    );
  }

  const stepType = assignment.workflowStep?.stepType ?? '';
  const isFillStep = stepType === 'fill';
  const isTerminal = ['approved', 'rejected', 'forwarded', 'expired'].includes(assignment.status);

  const availableActions: ApprovalAction[] = isFillStep
    ? []
    : isTerminal
      ? []
      : ['approve', 'reject', 'forward', 'request_correction'];

  const schema = submission?.formVersion?.schema as
    | { components?: RendererComponent[] }
    | undefined;
  const components: RendererComponent[] = schema?.components ?? [];
  const values = submission ? inflateValues(submission.values ?? []) : {};

  function renderComponents(comps: RendererComponent[], depth = 0): React.ReactNode {
    return comps.map((comp) => {
      if (comp.type === 'section' || comp.type === 'conditional_group') {
        const label = comp.label?.en ?? comp.key;
        return (
          <div key={comp.id} className={`mb-6 ${depth === 0 ? '' : 'pl-4 border-l-2 border-gray-200'}`}>
            <h3 className="font-semibold text-gray-800 mb-3 text-sm uppercase tracking-wide">
              {label}
            </h3>
            {comp.children && renderComponents(comp.children, depth + 1)}
          </div>
        );
      }

      const label = comp.label?.en ?? comp.key;

      return (
        <div key={comp.id} className="mb-4">
          <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            {label}
            {comp.isRequired && <span className="text-red-400 ml-0.5">*</span>}
          </dt>
          <dd className="text-gray-900">
            <ValueDisplay component={comp} value={values[comp.id]} />
          </dd>
        </div>
      );
    });
  }

  async function handleConfirmAction() {
    if (!selectedAction) return;
    setActionError(null);
    try {
      await takeAction.mutateAsync({ action: selectedAction, comment: comment.trim() || undefined });
      setActionSuccess(true);
      setConfirmOpen(false);
      setTimeout(() => router.push('/assignments'), 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit action';
      setActionError(msg);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/assignments" className="text-gray-500 hover:text-gray-800 text-sm">
            ← Assignments
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate">
              {(assignment.campaign?.title as Record<string, string> | undefined)?.en ?? 'Review'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-xs px-2 py-0.5 rounded font-medium ${stepTypeBadge(stepType)}`}
              >
                {stepType}
              </span>
              <span className="text-xs text-gray-500 capitalize">{assignment.status}</span>
              {assignment.deadline && (
                <span className="text-xs text-gray-400">
                  Due {formatDateTime(assignment.deadline)}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Submission values */}
        <div className="lg:col-span-2 bg-white rounded-lg border p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Submission</h2>

          {!submission ? (
            <p className="text-gray-500 text-sm">No submission found for this assignment.</p>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4 pb-4 border-b text-sm text-gray-500">
                <span>
                  Submitted:{' '}
                  <span className="text-gray-900">{formatDateTime(submission.submittedAt)}</span>
                </span>
                {submission.offlineFlag && (
                  <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded">
                    Offline sync
                  </span>
                )}
                <span
                  className={`text-xs px-2 py-0.5 rounded capitalize ${
                    submission.status === 'submitted'
                      ? 'bg-blue-100 text-blue-700'
                      : submission.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : submission.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {submission.status}
                </span>
              </div>

              <dl className="space-y-1">{renderComponents(components)}</dl>

              {submission.signatureHash && (
                <div className="mt-6 pt-4 border-t">
                  <p className="text-xs text-gray-400">
                    Signature hash:{' '}
                    <span className="font-mono break-all">{submission.signatureHash}</span>
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions + history sidebar */}
        <div className="flex flex-col gap-4">
          {/* Action panel */}
          {availableActions.length > 0 && !isTerminal && !actionSuccess && (
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-900 mb-3">Take Action</h2>

              {actionError && (
                <p className="text-red-600 text-sm mb-3 bg-red-50 rounded p-2">{actionError}</p>
              )}

              <div className="flex flex-col gap-2 mb-4">
                {availableActions.map((action) => (
                  <button
                    key={action}
                    onClick={() => {
                      setSelectedAction(action);
                      setConfirmOpen(true);
                    }}
                    className={`w-full px-4 py-2 rounded font-medium text-sm transition-colors ${ACTION_COLOURS[action]}`}
                  >
                    {ACTION_LABELS[action]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {actionSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-green-700 font-medium text-sm">Action submitted successfully.</p>
              <p className="text-green-600 text-xs mt-1">Redirecting…</p>
            </div>
          )}

          {isTerminal && (
            <div className="bg-gray-50 border rounded-lg p-4 text-sm text-gray-600 text-center">
              This assignment is <span className="font-medium capitalize">{assignment.status}</span>.
            </div>
          )}

          {/* Approval history */}
          {history && history.length > 0 && (
            <div className="bg-white rounded-lg border p-4">
              <h2 className="font-semibold text-gray-900 mb-3 text-sm">History</h2>
              <ol className="space-y-3">
                {history.map((event) => {
                  const stepName =
                    typeof event.workflowStep?.name === 'object' && event.workflowStep.name !== null
                      ? (event.workflowStep.name as Record<string, string>).en ??
                        event.workflowStep.stepType
                      : event.workflowStep?.stepType;
                  return (
                    <li key={event.id} className="flex gap-3 text-xs">
                      <div className="flex flex-col items-center">
                        <span className="w-2 h-2 rounded-full bg-blue-400 mt-0.5 shrink-0" />
                        <span className="w-px flex-1 bg-gray-200" />
                      </div>
                      <div className="pb-3 min-w-0">
                        <p className="font-medium text-gray-800 capitalize">
                          {event.action.replace('_', ' ')}
                          <span className="font-normal text-gray-500 ml-1">on {stepName}</span>
                        </p>
                        <p className="text-gray-500">{event.actor.email}</p>
                        <p className="text-gray-400">{formatDateTime(event.createdAt)}</p>
                        {event.comment && (
                          <p className="mt-1 text-gray-700 bg-gray-50 rounded p-1 italic">
                            &ldquo;{event.comment}&rdquo;
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      </main>

      {/* Confirm action modal */}
      {confirmOpen && selectedAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-1">
              {ACTION_LABELS[selectedAction]}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              This action cannot be undone. Add an optional comment below.
            </p>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comment (optional, max 2000 chars)"
              maxLength={2000}
              rows={4}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4"
            />

            {actionError && (
              <p className="text-red-600 text-sm mb-3 bg-red-50 rounded p-2">{actionError}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  setSelectedAction(null);
                  setComment('');
                  setActionError(null);
                }}
                className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={takeAction.isPending}
                className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 ${ACTION_COLOURS[selectedAction]}`}
              >
                {takeAction.isPending ? 'Submitting…' : `Confirm ${ACTION_LABELS[selectedAction]}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
