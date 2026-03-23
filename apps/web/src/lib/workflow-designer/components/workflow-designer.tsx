'use client';

import { useCallback, useState } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Connection,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { WorkflowStepDef, WorkflowTransitionDef, StepType, TriggerAction } from '../types';
import type { WorkflowNode, WorkflowEdge } from '../types';
import { WorkflowStepNode } from './workflow-step-node';
import { StepConfigPanel } from './step-config-panel';
import { AddStepPanel } from './add-step-panel';
import { TRIGGER_ACTIONS } from '../step-colours';

const NODE_TYPES = { workflowStep: WorkflowStepNode };

interface WorkflowDesignerProps {
  initialSteps: WorkflowStepDef[];
  initialTransitions: WorkflowTransitionDef[];
  roles: Array<{ id: string; code: string; name: Record<string, string> }>;
  onAddStep: (stepType: StepType, nameEn: string) => Promise<WorkflowStepDef>;
  onUpdateStep: (stepId: string, changes: Partial<WorkflowStepDef>) => Promise<void>;
  onDeleteStep: (stepId: string) => Promise<void>;
  onAddTransition: (fromStepId: string, toStepId: string, triggerAction: TriggerAction) => Promise<WorkflowTransitionDef>;
  onDeleteTransition: (transitionId: string) => Promise<void>;
  readOnly?: boolean;
}

function stepsToNodes(steps: WorkflowStepDef[]): WorkflowNode[] {
  return steps.map((step, i) => ({
    id: step.id,
    type: 'workflowStep' as const,
    position: { x: 300, y: i * 150 },
    data: {
      stepId: step.id,
      name: step.name,
      stepType: step.stepType,
      assigneeRole: step.assigneeRole,
      assigneeNodeRel: step.assigneeNodeRel,
      deadlineOffsetHours: step.deadlineOffsetHours,
      escalationStep: step.escalationStep,
      orderIndex: step.orderIndex,
    },
  }));
}

function transitionsToEdges(transitions: WorkflowTransitionDef[]): WorkflowEdge[] {
  return transitions.map((t) => ({
    id: t.id,
    source: t.fromStepId,
    target: t.toStepId,
    label: t.triggerAction,
    type: 'smoothstep',
    data: {
      transitionId: t.id,
      triggerAction: t.triggerAction,
      conditions: t.conditions,
    },
  }));
}

export function WorkflowDesigner({
  initialSteps,
  initialTransitions,
  roles,
  onAddStep,
  onUpdateStep,
  onDeleteStep,
  onAddTransition,
  onDeleteTransition,
  readOnly = false,
}: WorkflowDesignerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode['data']>(
    stepsToNodes(initialSteps),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowEdge['data']>(
    transitionsToEdges(initialTransitions),
  );

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [steps, setSteps] = useState<WorkflowStepDef[]>(initialSteps);

  // Pending connection state for transition trigger dialog
  const [pendingConnection, setPendingConnection] = useState<{
    fromStepId: string;
    toStepId: string;
  } | null>(null);
  const [triggerAction, setTriggerAction] = useState<TriggerAction>('submit');

  const selectedStep = steps.find((s) => s.id === selectedStepId) ?? null;

  // Node click → select
  const handleNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    setSelectedStepId((cur) => (cur === node.id ? null : node.id));
  }, []);

  // Edge click → delete transition
  const handleEdgeClick: EdgeMouseHandler = useCallback(
    async (_e, edge) => {
      if (readOnly) return;
      if (!edge.data?.transitionId) return;
      if (!confirm(`Delete transition "${edge.label as string}"?`)) return;
      await onDeleteTransition(edge.data.transitionId as string);
      setEdges((es) => es.filter((e) => e.id !== edge.id));
    },
    [onDeleteTransition, setEdges, readOnly],
  );

  // Drag connection end → open trigger dialog
  const handleConnect = useCallback(
    (params: Connection) => {
      if (readOnly || !params.source || !params.target) return;
      setPendingConnection({ fromStepId: params.source, toStepId: params.target });
    },
    [readOnly],
  );

  async function confirmTransition() {
    if (!pendingConnection) return;
    const transition = await onAddTransition(
      pendingConnection.fromStepId,
      pendingConnection.toStepId,
      triggerAction,
    );
    setEdges((es) =>
      addEdge(
        {
          id: transition.id,
          source: transition.fromStepId,
          target: transition.toStepId,
          label: transition.triggerAction,
          type: 'smoothstep',
          data: { transitionId: transition.id, triggerAction: transition.triggerAction },
        },
        es,
      ),
    );
    setPendingConnection(null);
  }

  async function handleAddStep(stepType: StepType, nameEn: string) {
    const newStep = await onAddStep(stepType, nameEn);
    setSteps((prev) => [...prev, newStep]);
    setNodes((ns) => [
      ...ns,
      {
        id: newStep.id,
        type: 'workflowStep' as const,
        position: { x: 300, y: ns.length * 150 },
        data: {
          stepId: newStep.id,
          name: newStep.name,
          stepType: newStep.stepType,
          assigneeRole: newStep.assigneeRole,
          assigneeNodeRel: newStep.assigneeNodeRel,
          deadlineOffsetHours: newStep.deadlineOffsetHours,
          escalationStep: newStep.escalationStep,
          orderIndex: newStep.orderIndex,
        },
      },
    ]);
  }

  async function handleUpdateStep(stepId: string, changes: Partial<WorkflowStepDef>) {
    await onUpdateStep(stepId, changes);
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...changes } : s)));
    setNodes((ns) =>
      ns.map((n) =>
        n.id === stepId
          ? {
              ...n,
              data: {
                ...n.data,
                name: (changes.name as Record<string, string>) ?? n.data.name,
                stepType: changes.stepType ?? n.data.stepType,
                assigneeRole: changes.assigneeRole !== undefined ? changes.assigneeRole : n.data.assigneeRole,
                assigneeNodeRel: changes.assigneeNodeRel !== undefined ? changes.assigneeNodeRel : n.data.assigneeNodeRel,
                deadlineOffsetHours: changes.deadlineOffsetHours !== undefined ? changes.deadlineOffsetHours : n.data.deadlineOffsetHours,
              },
            }
          : n,
      ),
    );
  }

  async function handleDeleteStep(stepId: string) {
    if (!confirm('Delete this step? All transitions to/from it will also be removed.')) return;
    await onDeleteStep(stepId);
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
    setNodes((ns) => ns.filter((n) => n.id !== stepId));
    setEdges((es) => es.filter((e) => e.source !== stepId && e.target !== stepId));
    setSelectedStepId(null);
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel */}
      {!readOnly && (
        <aside className="w-52 shrink-0 border-e bg-card p-4">
          <AddStepPanel onAdd={handleAddStep} />
        </aside>
      )}

      {/* React Flow canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={readOnly ? undefined : onNodesChange}
          onEdgesChange={readOnly ? undefined : onEdgesChange}
          onConnect={handleConnect}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          fitView
          deleteKeyCode={null} // prevent accidental deletes; handle via panel
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
          <MiniMap nodeStrokeWidth={3} pannable />
        </ReactFlow>

        {/* Transition trigger dialog */}
        {pendingConnection && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-50">
            <div className="rounded-lg border bg-card p-6 shadow-xl space-y-4 w-72">
              <h3 className="font-semibold text-sm">Connect steps</h3>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Trigger action</label>
                <select
                  value={triggerAction}
                  onChange={(e) => setTriggerAction(e.target.value as TriggerAction)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  {TRIGGER_ACTIONS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setPendingConnection(null)}
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void confirmTransition()}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Connect
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right panel — step config */}
      {!readOnly && selectedStep && (
        <StepConfigPanel
          step={selectedStep}
          allSteps={steps}
          roles={roles}
          onUpdate={(id, changes) => void handleUpdateStep(id, changes)}
          onDelete={(id) => void handleDeleteStep(id)}
        />
      )}
    </div>
  );
}
