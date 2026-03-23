'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { FormComponentDef, ComponentType } from '../types';
import { ComponentPalette } from './component-palette';
import { FormCanvas } from './form-canvas';
import { ComponentConfigPanel } from './component-config-panel';

interface FormBuilderProps {
  initialComponents?: FormComponentDef[];
  onSave: (components: FormComponentDef[]) => Promise<void>;
  isSaving?: boolean;
  readOnly?: boolean;
}

function generateKey(type: ComponentType, existing: FormComponentDef[]): string {
  const base = type.replace('_', '');
  const count = existing.filter((c) => c.componentType === type).length + 1;
  return `${base}_${count}`;
}

export function FormBuilder({
  initialComponents = [],
  onSave,
  isSaving = false,
  readOnly = false,
}: FormBuilderProps) {
  const [components, setComponents] = useState<FormComponentDef[]>(initialComponents);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDragType, setActiveDragType] = useState<ComponentType | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const selectedComponent = components.find((c) => c.id === selectedId) ?? null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.isPalette) {
      setActiveDragType(data.componentType as ComponentType);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragType(null);
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current;
      const overId = over.id as string;

      // Drop from palette onto canvas
      if (activeData?.isPalette) {
        const type = activeData.componentType as ComponentType;
        const newComponent: FormComponentDef = {
          id: crypto.randomUUID(),
          parentId: null,
          orderIndex: components.filter((c) => c.parentId === null).length,
          componentType: type,
          key: generateKey(type, components),
          label: { en: '' },
          isRequired: false,
        };

        setComponents((prev) => [...prev, newComponent]);
        setSelectedId(newComponent.id);
        return;
      }

      // Reorder within canvas
      if (activeData?.isCanvas && overId !== 'form-canvas') {
        const activeId = active.id as string;
        if (activeId === overId) return;

        setComponents((prev) => {
          const oldIndex = prev.findIndex((c) => c.id === activeId);
          const newIndex = prev.findIndex((c) => c.id === overId);
          if (oldIndex === -1 || newIndex === -1) return prev;

          const reordered = arrayMove(prev, oldIndex, newIndex);
          return reordered.map((c, i) => ({
            ...c,
            orderIndex: c.parentId === null ? i : c.orderIndex,
          }));
        });
      }
    },
    [components],
  );

  const handleDelete = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id && c.parentId !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const handleUpdate = useCallback((id: string, changes: Partial<FormComponentDef>) => {
    setComponents((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...changes } : c)),
    );
  }, []);

  const handleSave = async () => {
    await onSave(components);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full overflow-hidden">
        {/* Left: Component palette */}
        {!readOnly && <ComponentPalette />}

        {/* Centre: Canvas */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-sm text-muted-foreground">
              {components.length} component{components.length !== 1 ? 's' : ''}
            </span>
            {!readOnly && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSaving ? 'Saving…' : 'Save draft'}
              </button>
            )}
          </div>

          <FormCanvas
            components={components}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
            onDelete={handleDelete}
          />
        </div>

        {/* Right: Config panel */}
        {!readOnly && selectedComponent && (
          <ComponentConfigPanel component={selectedComponent} onUpdate={handleUpdate} />
        )}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeDragType && (
          <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-lg opacity-90">
            {activeDragType}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
