'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FormComponentDef } from '../types';
import { getComponentMeta } from '../component-catalogue';

interface SortableComponentItemProps {
  component: FormComponentDef;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  depth?: number;
  children?: React.ReactNode;
}

export function SortableComponentItem({
  component,
  isSelected,
  onSelect,
  onDelete,
  depth = 0,
  children,
}: SortableComponentItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: component.id,
    data: { isCanvas: true, componentId: component.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingInlineStart: depth > 0 ? `${depth * 1.25}rem` : undefined,
  };

  const meta = getComponentMeta(component.componentType);
  const displayLabel = component.label.en || component.key;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative ${isDragging ? 'opacity-40' : ''}`}
    >
      <div
        onClick={() => onSelect(component.id)}
        className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm cursor-pointer transition-colors ${
          isSelected
            ? 'border-primary bg-primary/5'
            : 'border-border bg-card hover:bg-accent/50'
        }`}
      >
        {/* Drag handle */}
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground select-none"
          onClick={(e) => e.stopPropagation()}
        >
          ⠿
        </span>

        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-xs font-bold">
          {meta?.icon ?? '?'}
        </span>

        <div className="min-w-0 flex-1">
          <span className="font-medium">{displayLabel}</span>
          <span className="ms-2 text-xs text-muted-foreground">{component.componentType}</span>
          {component.isRequired && (
            <span className="ms-1 text-xs text-destructive">*</span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(component.id);
          }}
          className="hidden group-hover:flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          ×
        </button>
      </div>

      {/* Children (sections / conditional groups) */}
      {children && <div className="mt-1 space-y-1">{children}</div>}
    </div>
  );
}
