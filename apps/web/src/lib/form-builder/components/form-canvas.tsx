'use client';

import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import type { FormComponentDef } from '../types';
import { SortableComponentItem } from './sortable-component-item';

interface FormCanvasProps {
  components: FormComponentDef[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function ComponentTree({
  components,
  allComponents,
  parentId,
  selectedId,
  onSelect,
  onDelete,
  depth,
}: {
  components: FormComponentDef[];
  allComponents: FormComponentDef[];
  parentId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  depth: number;
}) {
  const items = components
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <>
      {items.map((component) => {
        const hasChildren = allComponents.some((c) => c.parentId === component.id);
        return (
          <SortableComponentItem
            key={component.id}
            component={component}
            isSelected={selectedId === component.id}
            onSelect={onSelect}
            onDelete={onDelete}
            depth={depth}
          >
            {hasChildren && (
              <ComponentTree
                components={allComponents}
                allComponents={allComponents}
                parentId={component.id}
                selectedId={selectedId}
                onSelect={onSelect}
                onDelete={onDelete}
                depth={depth + 1}
              />
            )}
          </SortableComponentItem>
        );
      })}
    </>
  );
}

export function FormCanvas({ components, selectedId, onSelect, onDelete }: FormCanvasProps) {
  const { setNodeRef, isOver } = useDroppable({ id: 'form-canvas' });

  const ids = components
    .filter((c) => c.parentId === null)
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((c) => c.id);

  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-6 space-y-2 min-h-[400px] transition-colors ${
          isOver ? 'bg-primary/5' : ''
        }`}
      >
        {components.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed text-sm text-muted-foreground">
            Drag components here to build your form
          </div>
        ) : (
          <ComponentTree
            components={components}
            allComponents={components}
            parentId={null}
            selectedId={selectedId}
            onSelect={onSelect}
            onDelete={onDelete}
            depth={0}
          />
        )}
      </div>
    </SortableContext>
  );
}
