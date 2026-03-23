'use client';

import { use } from 'react';
import Link from 'next/link';
import { useWorkflow, usePublishWorkflow } from '@/lib/api/hooks/use-workflows';

export default function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: workflow, isLoading, isError } = useWorkflow(id);
  const publishWorkflow = usePublishWorkflow(id);

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (isError || !workflow) return <div className="p-8 text-sm text-destructive">Failed to load workflow</div>;

  const nameEn = (workflow.name as Record<string, string>).en;

  return (
    <div className="p-8 space-y-6">
      {/* Breadcrumb */}
      <div className="text-xs text-muted-foreground">
        <Link href="/admin/workflows" className="hover:underline">Workflows</Link>
        {' / '}
        <span>{nameEn}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{nameEn}</h1>
          {workflow.ownerNode && (
            <p className="text-xs text-muted-foreground mt-1">
              Owner: [{workflow.ownerNode.code}]{' '}
              {(workflow.ownerNode.name as Record<string, string>).en} ({workflow.ownerNode.nodeType})
            </p>
          )}
          {workflow.createdBy && (
            <p className="text-xs text-muted-foreground">
              Created by: {workflow.createdBy.email}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {!workflow.isPublished && (
            <>
              <Link
                href={`/admin/workflows/${id}/designer`}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Open designer
              </Link>
              <button
                onClick={() => void publishWorkflow.mutateAsync()}
                disabled={publishWorkflow.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {publishWorkflow.isPending ? 'Publishing…' : 'Publish'}
              </button>
            </>
          )}
          {workflow.isPublished && (
            <Link
              href={`/admin/workflows/${id}/designer`}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              View diagram
            </Link>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        {workflow.isPublished ? (
          <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
            Published
          </span>
        ) : (
          <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">
            Draft
          </span>
        )}
        {publishWorkflow.isError && (
          <span className="text-sm text-destructive">Publish failed — ensure an &quot;end&quot; step exists.</span>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">
          Steps ({workflow.steps?.length ?? 0})
        </h2>
        {(!workflow.steps || workflow.steps.length === 0) ? (
          <p className="text-sm text-muted-foreground">No steps yet. Open the designer to build the workflow.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {workflow.steps.map((step) => (
              <div key={step.id} className="flex items-center gap-4 px-4 py-3">
                <span className="w-6 text-xs text-muted-foreground text-center">
                  {step.orderIndex + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">
                    {(step.name as Record<string, string>).en}
                  </span>
                  <span className="ms-2 rounded-full bg-secondary px-2 py-0.5 text-xs">
                    {step.stepType}
                  </span>
                  {step.assigneeRole && (
                    <span className="ms-2 text-xs text-muted-foreground">
                      → {(step.assigneeRole.name as Record<string, string>).en ?? step.assigneeRole.code}
                    </span>
                  )}
                  {step.deadlineOffsetHours != null && (
                    <span className="ms-2 text-xs text-muted-foreground">
                      ⏱ {step.deadlineOffsetHours}h
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                  {step.outgoingTransitions?.map((t) => (
                    <span key={t.id}>
                      {t.triggerAction} → {(t.toStep?.name as Record<string, string>)?.en ?? '?'}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
