'use client';

import { use } from 'react';
import Link from 'next/link';
import { useWorkflow } from '@/lib/api/hooks/use-workflows';
import {
  useCreateWorkflowStep,
  useUpdateWorkflowStep,
  useDeleteWorkflowStep,
  useCreateWorkflowTransition,
  useDeleteWorkflowTransition,
} from '@/lib/api/hooks/use-workflows';
import { WorkflowDesigner } from '@/lib/workflow-designer/components/workflow-designer';
import type { WorkflowStepDef, WorkflowTransitionDef, StepType, TriggerAction, NodeRelType } from '@/lib/workflow-designer/types';

// Lazy-import roles — reuse the roles list hook from phase 2
import { useRoles } from '@/lib/api/hooks/use-roles';

export default function WorkflowDesignerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: workflow, isLoading, isError } = useWorkflow(id);
  const { data: rolesData } = useRoles();

  const createStep = useCreateWorkflowStep(id);
  const updateStep = useUpdateWorkflowStep(id);
  const deleteStep = useDeleteWorkflowStep(id);
  const createTransition = useCreateWorkflowTransition(id);
  const deleteTransition = useDeleteWorkflowTransition(id);

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (isError || !workflow) return <div className="p-8 text-sm text-destructive">Failed to load workflow</div>;

  const nameEn = (workflow.name as Record<string, string>).en;

  async function handleAddStep(stepType: StepType, nameEn: string): Promise<WorkflowStepDef> {
    const orderIndex = workflow.steps?.length ?? 0;
    return createStep.mutateAsync({ name: { en: nameEn }, stepType, orderIndex });
  }

  async function handleUpdateStep(stepId: string, changes: Partial<WorkflowStepDef>) {
    await updateStep.mutateAsync({ stepId, ...changes });
  }

  async function handleDeleteStep(stepId: string) {
    await deleteStep.mutateAsync(stepId);
  }

  async function handleAddTransition(
    fromStepId: string,
    toStepId: string,
    triggerAction: TriggerAction,
  ): Promise<WorkflowTransitionDef> {
    return createTransition.mutateAsync({ fromStepId, toStepId, triggerAction });
  }

  async function handleDeleteTransition(transitionId: string) {
    await deleteTransition.mutateAsync(transitionId);
  }

  const roles = rolesData?.data ?? [];

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-4 border-b px-6 py-3 bg-card shrink-0">
        <Link href={`/admin/workflows/${id}`} className="text-xs text-muted-foreground hover:underline">
          ← Back
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{nameEn}</span>
          {workflow.isPublished ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
              Published
            </span>
          ) : (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
              Draft
            </span>
          )}
        </div>
        <p className="ms-auto text-xs text-muted-foreground">
          {workflow.isPublished
            ? 'Published workflows are read-only'
            : 'Drag to connect steps • Click step to configure • Click edge to delete'}
        </p>
      </header>

      {/* Designer */}
      <div className="flex-1 overflow-hidden">
        <WorkflowDesigner
          initialSteps={(workflow.steps ?? []) as WorkflowStepDef[]}
          initialTransitions={(workflow.transitions ?? []) as WorkflowTransitionDef[]}
          roles={roles as Array<{ id: string; code: string; name: Record<string, string> }>}
          onAddStep={handleAddStep}
          onUpdateStep={handleUpdateStep}
          onDeleteStep={handleDeleteStep}
          onAddTransition={handleAddTransition}
          onDeleteTransition={handleDeleteTransition}
          readOnly={workflow.isPublished}
        />
      </div>
    </div>
  );
}
