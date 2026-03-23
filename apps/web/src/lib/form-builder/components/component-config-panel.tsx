'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { FormComponentDef, MultilingualString } from '../types';
import { MultilingualInput } from './multilingual-input';

interface ComponentConfigPanelProps {
  component: FormComponentDef;
  onUpdate: (id: string, changes: Partial<FormComponentDef>) => void;
}

export function ComponentConfigPanel({ component, onUpdate }: ComponentConfigPanelProps) {
  const { register, watch, setValue, reset } = useForm({
    defaultValues: {
      key: component.key,
      isRequired: component.isRequired,
    },
  });

  // Reset form when selection changes
  useEffect(() => {
    reset({ key: component.key, isRequired: component.isRequired });
  }, [component.id, reset, component.key, component.isRequired]);

  const key = watch('key');
  const isRequired = watch('isRequired');

  useEffect(() => {
    if (key !== component.key) onUpdate(component.id, { key });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isRequired !== component.isRequired) onUpdate(component.id, { isRequired });
  }, [isRequired]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleLabelChange(value: MultilingualString) {
    onUpdate(component.id, { label: value });
  }

  function handlePlaceholderChange(value: MultilingualString) {
    onUpdate(component.id, { placeholder: value });
  }

  function handleHelpTextChange(value: MultilingualString) {
    onUpdate(component.id, { helpText: value });
  }

  const showOptions = ['dropdown', 'multi_select'].includes(component.componentType);
  const showTableSchema = component.componentType === 'table';
  const showValidation = ['text', 'number', 'file_upload'].includes(component.componentType);

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-s bg-card p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Field settings</h3>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
          {component.componentType}
        </span>
      </div>

      {/* Key */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Field key *</label>
        <input
          type="text"
          {...register('key')}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
        />
        <p className="text-xs text-muted-foreground">Unique identifier used in submission values</p>
      </div>

      {/* Required */}
      <div className="flex items-center gap-2">
        <input type="checkbox" id="isRequired" {...register('isRequired')} className="rounded" />
        <label htmlFor="isRequired" className="text-sm">
          Required field
        </label>
      </div>

      {/* Label */}
      <MultilingualInput
        label="Label"
        value={component.label}
        onChange={handleLabelChange}
        required
      />

      {/* Placeholder (not for layout components) */}
      {!['section', 'conditional_group', 'table'].includes(component.componentType) && (
        <MultilingualInput
          label="Placeholder"
          value={component.placeholder ?? { en: '' }}
          onChange={handlePlaceholderChange}
        />
      )}

      {/* Help text */}
      <MultilingualInput
        label="Help text"
        value={component.helpText ?? { en: '' }}
        onChange={handleHelpTextChange}
        multiline
      />

      {/* Options (dropdown / multi_select) */}
      {showOptions && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Options</p>
          <div className="space-y-1">
            {(component.options ?? []).map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  defaultValue={opt.label.en}
                  className="flex-1 rounded-md border bg-background px-2 py-1 text-xs"
                  onBlur={(e) => {
                    const updated = [...(component.options ?? [])];
                    updated[i] = { ...opt, label: { ...opt.label, en: e.target.value } };
                    onUpdate(component.id, { options: updated });
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const updated = (component.options ?? []).filter((_, j) => j !== i);
                    onUpdate(component.id, { options: updated });
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const newOpt = {
                value: `option_${Date.now()}`,
                label: { en: 'New option' },
              };
              onUpdate(component.id, { options: [...(component.options ?? []), newOpt] });
            }}
            className="text-xs text-primary hover:underline"
          >
            + Add option
          </button>
        </div>
      )}

      {/* Table schema */}
      {showTableSchema && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Table columns</p>
          <div className="space-y-1">
            {(component.tableSchema?.columns ?? []).map((col, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  defaultValue={col.label.en}
                  className="flex-1 rounded-md border bg-background px-2 py-1 text-xs"
                  onBlur={(e) => {
                    const cols = [...(component.tableSchema?.columns ?? [])];
                    cols[i] = { ...col, label: { ...col.label, en: e.target.value } };
                    onUpdate(component.id, {
                      tableSchema: { ...(component.tableSchema ?? {}), columns: cols },
                    });
                  }}
                />
                <select
                  defaultValue={col.type}
                  className="rounded-md border bg-background px-1 py-1 text-xs"
                  onChange={(e) => {
                    const cols = [...(component.tableSchema?.columns ?? [])];
                    cols[i] = { ...col, type: e.target.value as typeof col.type };
                    onUpdate(component.id, {
                      tableSchema: { ...(component.tableSchema ?? {}), columns: cols },
                    });
                  }}
                >
                  {['text', 'number', 'date', 'dropdown'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const cols = (component.tableSchema?.columns ?? []).filter((_, j) => j !== i);
                    onUpdate(component.id, {
                      tableSchema: { ...(component.tableSchema ?? {}), columns: cols },
                    });
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const newCol = {
                key: `col_${Date.now()}`,
                label: { en: 'New column' },
                type: 'text' as const,
                required: false,
              };
              const cols = [...(component.tableSchema?.columns ?? []), newCol];
              onUpdate(component.id, {
                tableSchema: { ...(component.tableSchema ?? { allow_add_rows: true }), columns: cols },
              });
            }}
            className="text-xs text-primary hover:underline"
          >
            + Add column
          </button>
        </div>
      )}

      {/* Validation */}
      {showValidation && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Validation</p>
          {component.componentType === 'text' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Min length</label>
                <input
                  type="number"
                  defaultValue={component.validation?.minLength}
                  className="w-full rounded-md border bg-background px-2 py-1 text-xs"
                  onBlur={(e) =>
                    onUpdate(component.id, {
                      validation: {
                        ...(component.validation ?? {}),
                        minLength: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Max length</label>
                <input
                  type="number"
                  defaultValue={component.validation?.maxLength}
                  className="w-full rounded-md border bg-background px-2 py-1 text-xs"
                  onBlur={(e) =>
                    onUpdate(component.id, {
                      validation: {
                        ...(component.validation ?? {}),
                        maxLength: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                />
              </div>
            </div>
          )}
          {component.componentType === 'number' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Min</label>
                <input
                  type="number"
                  defaultValue={component.validation?.min}
                  className="w-full rounded-md border bg-background px-2 py-1 text-xs"
                  onBlur={(e) =>
                    onUpdate(component.id, {
                      validation: {
                        ...(component.validation ?? {}),
                        min: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Max</label>
                <input
                  type="number"
                  defaultValue={component.validation?.max}
                  className="w-full rounded-md border bg-background px-2 py-1 text-xs"
                  onBlur={(e) =>
                    onUpdate(component.id, {
                      validation: {
                        ...(component.validation ?? {}),
                        max: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
