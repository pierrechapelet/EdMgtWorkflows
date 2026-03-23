import type { StepType } from './types';

export const STEP_TYPE_CONFIG: Record<
  StepType,
  { label: string; bg: string; border: string; text: string; icon: string }
> = {
  fill: {
    label: 'Fill',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-800',
    icon: '✏️',
  },
  review: {
    label: 'Review',
    bg: 'bg-purple-50',
    border: 'border-purple-300',
    text: 'text-purple-800',
    icon: '🔍',
  },
  approve: {
    label: 'Approve',
    bg: 'bg-green-50',
    border: 'border-green-300',
    text: 'text-green-800',
    icon: '✅',
  },
  reject: {
    label: 'Reject',
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-800',
    icon: '❌',
  },
  forward: {
    label: 'Forward',
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    text: 'text-orange-800',
    icon: '➡️',
  },
  notify: {
    label: 'Notify',
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    text: 'text-yellow-800',
    icon: '🔔',
  },
  end: {
    label: 'End',
    bg: 'bg-gray-50',
    border: 'border-gray-400',
    text: 'text-gray-700',
    icon: '⏹',
  },
};

export const STEP_TYPES: StepType[] = ['fill', 'review', 'approve', 'reject', 'forward', 'notify', 'end'];
export const TRIGGER_ACTIONS = ['submit', 'approve', 'reject', 'forward', 'timeout'] as const;
export const NODE_REL_TYPES = ['absolute', 'parent', 'ancestor', 'peer', 'custom'] as const;
