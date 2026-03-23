import type { ComponentType } from './types';

export interface ComponentMeta {
  type: ComponentType;
  label: string;
  description: string;
  icon: string;
  group: 'basic' | 'choice' | 'advanced' | 'layout';
  canHaveChildren: boolean;
}

export const COMPONENT_CATALOGUE: ComponentMeta[] = [
  // Basic
  {
    type: 'text',
    label: 'Text',
    description: 'Single or multi-line text input',
    icon: 'T',
    group: 'basic',
    canHaveChildren: false,
  },
  {
    type: 'number',
    label: 'Number',
    description: 'Numeric input with optional min/max',
    icon: '#',
    group: 'basic',
    canHaveChildren: false,
  },
  {
    type: 'date',
    label: 'Date',
    description: 'Date picker',
    icon: 'D',
    group: 'basic',
    canHaveChildren: false,
  },
  {
    type: 'datetime',
    label: 'Date & Time',
    description: 'Date and time picker',
    icon: 'DT',
    group: 'basic',
    canHaveChildren: false,
  },
  // Choice
  {
    type: 'dropdown',
    label: 'Dropdown',
    description: 'Single-select from a list',
    icon: '▼',
    group: 'choice',
    canHaveChildren: false,
  },
  {
    type: 'multi_select',
    label: 'Multi-select',
    description: 'Multiple options selectable',
    icon: '☑',
    group: 'choice',
    canHaveChildren: false,
  },
  // Advanced
  {
    type: 'file_upload',
    label: 'File Upload',
    description: 'Upload one or more files',
    icon: '↑',
    group: 'advanced',
    canHaveChildren: false,
  },
  {
    type: 'signature',
    label: 'Signature',
    description: 'Drawn or typed signature (cryptographically bound)',
    icon: '✍',
    group: 'advanced',
    canHaveChildren: false,
  },
  {
    type: 'geo_coordinates',
    label: 'Location',
    description: 'GPS or map-selected coordinates',
    icon: '📍',
    group: 'advanced',
    canHaveChildren: false,
  },
  {
    type: 'table',
    label: 'Table',
    description: 'Fixed-column data table with typed cells',
    icon: '⊞',
    group: 'advanced',
    canHaveChildren: false,
  },
  // Layout
  {
    type: 'section',
    label: 'Section',
    description: 'Groups fields under a heading',
    icon: '§',
    group: 'layout',
    canHaveChildren: true,
  },
  {
    type: 'conditional_group',
    label: 'Conditional Group',
    description: 'Shows children only when conditions are met',
    icon: '?',
    group: 'layout',
    canHaveChildren: true,
  },
];

export const COMPONENT_GROUPS = ['basic', 'choice', 'advanced', 'layout'] as const;

export function getComponentMeta(type: ComponentType): ComponentMeta | undefined {
  return COMPONENT_CATALOGUE.find((c) => c.type === type);
}
