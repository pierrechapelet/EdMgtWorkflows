'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { WorkflowStepData } from '../types';
import { STEP_TYPE_CONFIG } from '../step-colours';

export const WorkflowStepNode = memo(function WorkflowStepNode({
  data,
  selected,
}: NodeProps<WorkflowStepData>) {
  const config = STEP_TYPE_CONFIG[data.stepType];

  return (
    <div
      className={`min-w-[180px] max-w-[220px] rounded-lg border-2 ${config.border} ${config.bg} px-3 py-2.5 shadow-sm transition-shadow ${
        selected ? 'shadow-md ring-2 ring-primary ring-offset-1' : ''
      }`}
    >
      {/* Top handle (incoming) */}
      {data.stepType !== 'fill' && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-white !border-2 !border-gray-400"
        />
      )}

      {/* Node content */}
      <div className="space-y-1">
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${config.text}`}>
          <span>{config.icon}</span>
          <span className="uppercase tracking-wide">{config.label}</span>
        </div>
        <p className="text-sm font-medium leading-tight text-foreground">
          {(data.name as Record<string, string>).en || 'Unnamed step'}
        </p>
        {data.assigneeRole && (
          <p className="text-xs text-muted-foreground truncate">
            Role: {(data.assigneeRole.name as Record<string, string>).en ?? data.assigneeRole.code}
          </p>
        )}
        {data.assigneeNodeRel && (
          <p className="text-xs text-muted-foreground">Node: {data.assigneeNodeRel}</p>
        )}
        {data.deadlineOffsetHours != null && (
          <p className="text-xs text-muted-foreground">⏱ {data.deadlineOffsetHours}h</p>
        )}
        {data.escalationStep && (
          <p className="text-xs text-orange-600 truncate">
            ↗ {(data.escalationStep.name as Record<string, string>).en ?? 'escalation'}
          </p>
        )}
      </div>

      {/* Bottom handle (outgoing) — all except 'end' */}
      {data.stepType !== 'end' && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-white !border-2 !border-gray-400"
        />
      )}
    </div>
  );
});
