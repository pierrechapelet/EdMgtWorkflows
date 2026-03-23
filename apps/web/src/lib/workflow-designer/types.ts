import type { Node, Edge } from 'reactflow';

export type StepType = 'fill' | 'review' | 'approve' | 'reject' | 'forward' | 'notify' | 'end';
export type TriggerAction = 'submit' | 'approve' | 'reject' | 'forward' | 'timeout';
export type NodeRelType = 'absolute' | 'parent' | 'ancestor' | 'peer' | 'custom';

export interface WorkflowStepData {
  stepId: string;
  name: Record<string, string>;
  stepType: StepType;
  assigneeRole?: { id: string; code: string; name: Record<string, string> } | null;
  assigneeNodeRel?: NodeRelType | null;
  deadlineOffsetHours?: number | null;
  escalationStep?: { id: string; name: Record<string, string>; stepType: StepType } | null;
  orderIndex: number;
}

export interface WorkflowTransitionData {
  transitionId: string;
  triggerAction: TriggerAction;
  conditions?: Record<string, unknown> | null;
}

export type WorkflowNode = Node<WorkflowStepData, 'workflowStep'>;
export type WorkflowEdge = Edge<WorkflowTransitionData>;

export interface WorkflowDefinitionDef {
  id: string;
  name: Record<string, string>;
  ownerNodeId: string;
  ownerNode?: { id: string; code: string; name: Record<string, string>; nodeType: string };
  createdBy?: { id: string; email: string };
  isPublished: boolean;
  createdAt: string;
  steps?: WorkflowStepDef[];
  transitions?: WorkflowTransitionDef[];
  _count?: { steps: number };
}

export interface WorkflowStepDef {
  id: string;
  workflowId: string;
  name: Record<string, string>;
  stepType: StepType;
  orderIndex: number;
  assigneeRoleId?: string | null;
  assigneeRole?: { id: string; code: string; name: Record<string, string> } | null;
  assigneeNodeId?: string | null;
  assigneeNodeRel?: NodeRelType | null;
  deadlineOffsetHours?: number | null;
  escalationStepId?: string | null;
  escalationStep?: { id: string; name: Record<string, string>; stepType: StepType } | null;
  escalationRoleId?: string | null;
  escalationRole?: { id: string; code: string; name: Record<string, string> } | null;
  escalationNodeRel?: NodeRelType | null;
  escalationNodeId?: string | null;
  outgoingTransitions?: WorkflowTransitionDef[];
}

export interface WorkflowTransitionDef {
  id: string;
  fromStepId: string;
  toStepId: string;
  triggerAction: TriggerAction;
  conditions?: Record<string, unknown> | null;
  fromStep?: { id: string; name: Record<string, string>; stepType: StepType };
  toStep?: { id: string; name: Record<string, string>; stepType: StepType };
}
