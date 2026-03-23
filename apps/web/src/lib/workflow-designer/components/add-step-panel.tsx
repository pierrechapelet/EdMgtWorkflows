'use client';

import { useState } from 'react';
import type { StepType } from '../types';
import { STEP_TYPES, STEP_TYPE_CONFIG } from '../step-colours';

interface AddStepPanelProps {
  onAdd: (stepType: StepType, nameEn: string) => void;
}

export function AddStepPanel({ onAdd }: AddStepPanelProps) {
  const [stepType, setStepType] = useState<StepType>('review');
  const [nameEn, setNameEn] = useState('');

  function handleAdd() {
    if (!nameEn.trim()) return;
    onAdd(stepType, nameEn.trim());
    setNameEn('');
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Add step
      </p>

      {/* Step type selector */}
      <div className="grid grid-cols-2 gap-1">
        {STEP_TYPES.map((t) => {
          const cfg = STEP_TYPE_CONFIG[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => setStepType(t)}
              className={`flex items-center gap-1.5 rounded border px-2 py-1.5 text-xs font-medium transition-colors ${
                stepType === t
                  ? `${cfg.bg} ${cfg.border} ${cfg.text}`
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              <span>{cfg.icon}</span>
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Name */}
      <input
        type="text"
        value={nameEn}
        onChange={(e) => setNameEn(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        placeholder="Step name…"
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      />

      <button
        type="button"
        disabled={!nameEn.trim()}
        onClick={handleAdd}
        className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        + Add step
      </button>
    </div>
  );
}
