'use client';

import { useDraggable } from '@dnd-kit/core';
import { COMPONENT_CATALOGUE, COMPONENT_GROUPS } from '../component-catalogue';
import type { ComponentType } from '../types';

interface PaletteItemProps {
  type: ComponentType;
  label: string;
  description: string;
  icon: string;
}

function PaletteItem({ type, label, description, icon }: PaletteItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { isPalette: true, componentType: type },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex cursor-grab items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm transition-shadow active:cursor-grabbing hover:shadow-sm ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-muted text-xs font-bold">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-medium leading-none">{label}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function ComponentPalette() {
  return (
    <aside className="w-56 shrink-0 overflow-y-auto border-e bg-card p-3 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
        Components
      </p>
      {COMPONENT_GROUPS.map((group) => {
        const items = COMPONENT_CATALOGUE.filter((c) => c.group === group);
        return (
          <div key={group} className="space-y-1">
            <p className="px-1 text-xs font-medium capitalize text-muted-foreground">{group}</p>
            {items.map((item) => (
              <PaletteItem
                key={item.type}
                type={item.type}
                label={item.label}
                description={item.description}
                icon={item.icon}
              />
            ))}
          </div>
        );
      })}
    </aside>
  );
}
