'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { WorkflowStepDef, StepType, NodeRelType } from '../types';
import { STEP_TYPES, NODE_REL_TYPES } from '../step-colours';

interface StepConfigPanelProps {
  step: WorkflowStepDef;
  allSteps: WorkflowStepDef[];
  roles: Array<{ id: string; code: string; name: Record<string, string> }>;
  onUpdate: (stepId: string, changes: Partial<WorkflowStepDef>) => void;
  onDelete: (stepId: string) => void;
}

interface StepForm {
  nameEn: string;
  stepType: StepType;
  assigneeRoleId: string;
  assigneeNodeRel: NodeRelType | '';
  deadlineOffsetHours: string;
  escalationStepId: string;
  escalationRoleId: string;
}

export function StepConfigPanel({
  step,
  allSteps,
  roles,
  onUpdate,
  onDelete,
}: StepConfigPanelProps) {
  const { register, watch, reset } = useForm<StepForm>({
    defaultValues: {
      nameEn: (step.name as Record<string, string>).en ?? '',
      stepType: step.stepType,
      assigneeRoleId: step.assigneeRoleId ?? '',
      assigneeNodeRel: (step.assigneeNodeRel as NodeRelType) ?? '',
      deadlineOffsetHours: step.deadlineOffsetHours?.toString() ?? '',
      escalationStepId: step.escalationStepId ?? '',
      escalationRoleId: step.escalationRoleId ?? '',
    },
  });

  useEffect(() => {
    reset({
      nameEn: (step.name as Record<string, string>).en ?? '',
      stepType: step.stepType,
      assigneeRoleId: step.assigneeRoleId ?? '',
      assigneeNodeRel: (step.assigneeNodeRel as NodeRelType) ?? '',
      deadlineOffsetHours: step.deadlineOffsetHours?.toString() ?? '',
      escalationStepId: step.escalationStepId ?? '',
      escalationRoleId: step.escalationRoleId ?? '',
    });
  }, [step.id, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const values = watch();

  function flush() {
    onUpdate(step.id, {
      name: { ...(step.name as Record<string, string>), en: values.nameEn },
      stepType: values.stepType,
      assigneeRoleId: values.assigneeRoleId || null,
      assigneeNodeRel: (values.assigneeNodeRel as NodeRelType) || null,
      deadlineOffsetHours: values.deadlineOffsetHours ? Number(values.deadlineOffsetHours) : null,
      escalationStepId: values.escalationStepId || null,
      escalationRoleId: values.escalationRoleId || null,
    });
  }

  const otherSteps = allSteps.filter((s) => s.id !== step.id);

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-s bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Step settings</h3>
        <button
          type="button"
          onClick={() => onDelete(step.id)}
          className="text-xs text-destructive hover:underline"
        >
          Delete step
        </button>
      </div>

      {/* Name */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Name (English) *</label>
        <input
          type="text"
          {...register('nameEn')}
          onBlur={flush}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      {/* Step type */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Step type *</label>
        <select
          {...register('stepType')}
          onBlur={flush}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          {STEP_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Assignee role */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Assignee role</label>
        <select
          {...register('assigneeRoleId')}
          onBlur={flush}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">— any role —</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              [{r.code}] {(r.name as Record<string, string>).en ?? r.code}
            </option>
          ))}
        </select>
      </div>

      {/* Assignee node relationship */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Node relationship</label>
        <select
          {...register('assigneeNodeRel')}
          onBlur={flush}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">— none —</option>
          {NODE_REL_TYPES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          How the assignee node is resolved relative to the submitter's node
        </p>
      </div>

      {/* Deadline */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Deadline offset (hours)</label>
        <input
          type="number"
          min={0}
          {...register('deadlineOffsetHours')}
          onBlur={flush}
          placeholder="e.g. 48"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      {/* Escalation step */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Escalation step</label>
        <select
          {...register('escalationStepId')}
          onBlur={flush}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">— none —</option>
          {otherSteps.map((s) => (
            <option key={s.id} value={s.id}>
              {(s.name as Record<string, string>).en ?? s.id} ({s.stepType})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Step assigned when this step's deadline passes
        </p>
      </div>

      {/* Escalation role */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Escalation role</label>
        <select
          {...register('escalationRoleId')}
          onBlur={flush}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">— none —</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              [{r.code}] {(r.name as Record<string, string>).en ?? r.code}
            </option>
          ))}
        </select>
      </div>
    </aside>
  );
}
