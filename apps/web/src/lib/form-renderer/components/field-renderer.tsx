'use client';

import { useState, useCallback } from 'react';
import type {
  RendererComponent,
  FieldValues,
  FieldValue,
  TableRow,
  GeoValue,
} from '../types';
import { SignaturePad } from '@/lib/signature/components/signature-pad';

interface FieldRendererProps {
  component: RendererComponent;
  values: FieldValues;
  onChange: (componentId: string, value: FieldValue) => void;
  lang?: 'en' | 'ar' | 'fr' | 'es';
  readOnly?: boolean;
}

function label(ml: { en?: string; ar?: string; fr?: string; es?: string } | undefined, lang: string): string {
  if (!ml) return '';
  return (ml as Record<string, string>)[lang] ?? ml.en ?? '';
}

function dir(lang: string) { return lang === 'ar' ? 'rtl' : 'ltr'; }

export function FieldRenderer({ component, values, onChange, lang = 'en', readOnly = false }: FieldRendererProps) {
  const value = values[component.id];
  const fieldDir = dir(lang);

  // ── Conditional visibility ────────────────────────────────────────────────
  if (component.conditions?.show_if?.length) {
    const rules = component.conditions.show_if;
    const logic = component.conditions.logic ?? 'and';
    const results = rules.map((r) => {
      const fieldVal = Object.entries(values).find(([k]) => k === r.field)?.[1];
      switch (r.operator) {
        case 'eq': return fieldVal === r.value;
        case 'neq': return fieldVal !== r.value;
        case 'empty': return !fieldVal;
        case 'not_empty': return !!fieldVal;
        case 'contains': return typeof fieldVal === 'string' && fieldVal.includes(r.value as string);
        default: return true;
      }
    });
    const visible = logic === 'and' ? results.every(Boolean) : results.some(Boolean);
    if (!visible) return null;
  }

  const inputClass =
    'w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60';

  // ── Section ───────────────────────────────────────────────────────────────
  if (component.type === 'section' || component.type === 'conditional_group') {
    return (
      <fieldset className="space-y-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">
          {label(component.label, lang)}
        </legend>
        {component.children?.map((child) => (
          <FieldRenderer
            key={child.id}
            component={child}
            values={values}
            onChange={onChange}
            lang={lang}
            readOnly={readOnly}
          />
        ))}
      </fieldset>
    );
  }

  const fieldLabel = label(component.label, lang);
  const fieldPlaceholder = label(component.placeholder, lang);
  const helpText = label(component.helpText, lang);

  return (
    <div className="space-y-1.5" dir={fieldDir}>
      <label className="text-sm font-medium text-foreground">
        {fieldLabel}
        {component.isRequired && <span className="ms-1 text-destructive">*</span>}
      </label>

      {/* ── Text ─────────────────────────────────────────────────────────── */}
      {component.type === 'text' && (
        <textarea
          rows={2}
          dir={fieldDir}
          value={(value as string) ?? ''}
          placeholder={fieldPlaceholder}
          disabled={readOnly}
          className={inputClass + ' resize-y'}
          onChange={(e) => onChange(component.id, e.target.value)}
          maxLength={component.validation?.maxLength}
          minLength={component.validation?.minLength}
        />
      )}

      {/* ── Number ───────────────────────────────────────────────────────── */}
      {component.type === 'number' && (
        <input
          type="number"
          dir="ltr"
          value={(value as number) ?? ''}
          placeholder={fieldPlaceholder}
          disabled={readOnly}
          className={inputClass}
          min={component.validation?.min}
          max={component.validation?.max}
          onChange={(e) =>
            onChange(component.id, e.target.value === '' ? null : Number(e.target.value))
          }
        />
      )}

      {/* ── Date / Datetime ──────────────────────────────────────────────── */}
      {(component.type === 'date' || component.type === 'datetime') && (
        <input
          type={component.type === 'datetime' ? 'datetime-local' : 'date'}
          dir="ltr"
          value={(value as string) ?? ''}
          disabled={readOnly}
          className={inputClass}
          onChange={(e) => onChange(component.id, e.target.value)}
        />
      )}

      {/* ── Dropdown ─────────────────────────────────────────────────────── */}
      {component.type === 'dropdown' && (
        <select
          dir={fieldDir}
          value={(value as string) ?? ''}
          disabled={readOnly}
          className={inputClass}
          onChange={(e) => onChange(component.id, e.target.value)}
        >
          <option value="">— {fieldPlaceholder || 'Select'} —</option>
          {component.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {label(opt.label, lang)}
            </option>
          ))}
        </select>
      )}

      {/* ── Multi-select ─────────────────────────────────────────────────── */}
      {component.type === 'multi_select' && (
        <div className="space-y-1.5">
          {component.options?.map((opt) => {
            const selected = ((value as string[]) ?? []).includes(opt.value);
            return (
              <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected}
                  disabled={readOnly}
                  className="rounded"
                  onChange={() => {
                    const cur = (value as string[]) ?? [];
                    onChange(
                      component.id,
                      selected ? cur.filter((v) => v !== opt.value) : [...cur, opt.value],
                    );
                  }}
                />
                {label(opt.label, lang)}
              </label>
            );
          })}
        </div>
      )}

      {/* ── File upload ──────────────────────────────────────────────────── */}
      {component.type === 'file_upload' && (
        <FileUploadField
          componentId={component.id}
          accept={component.validation?.accept}
          maxSizeBytes={component.validation?.maxSize}
          currentKey={value as string | null}
          onChange={(key) => onChange(component.id, key)}
          readOnly={readOnly}
        />
      )}

      {/* ── Signature ────────────────────────────────────────────────────── */}
      {component.type === 'signature' && (
        <SignaturePad
          value={value as { mode: 'drawn' | 'typed'; imageBase64?: string; typedName?: string } | null}
          onChange={(sig) => onChange(component.id, sig as FieldValue)}
          readOnly={readOnly}
        />
      )}

      {/* ── Geo coordinates ──────────────────────────────────────────────── */}
      {component.type === 'geo_coordinates' && (
        <GeoField
          componentId={component.id}
          value={value as GeoValue | null}
          onChange={(geo) => onChange(component.id, geo)}
          readOnly={readOnly}
        />
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {component.type === 'table' && component.tableSchema && (
        <TableField
          componentId={component.id}
          schema={component.tableSchema}
          value={(value as TableRow[]) ?? []}
          onChange={(rows) => onChange(component.id, rows)}
          lang={lang}
          readOnly={readOnly}
        />
      )}

      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}

// ── File upload sub-component ─────────────────────────────────────────────────

function FileUploadField({
  componentId,
  accept,
  maxSizeBytes,
  currentKey,
  onChange,
  readOnly,
}: {
  componentId: string;
  accept?: string;
  maxSizeBytes?: number;
  currentKey: string | null | undefined;
  onChange: (key: string | null) => void;
  readOnly: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (maxSizeBytes && file.size > maxSizeBytes) {
      setError(`File exceeds maximum size of ${Math.round(maxSizeBytes / 1024 / 1024)}MB`);
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // Request presigned URL from backend
      const res = await fetch('/api/submissions/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: componentId, // placeholder — real impl passes assignmentId via context
          componentId,
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      const { data } = (await res.json()) as { data: { uploadUrl: string; key: string } };

      // Upload directly to S3
      await fetch(data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      onChange(data.key);
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1">
      {currentKey ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="flex-1 truncate text-xs text-muted-foreground font-mono">
            {currentKey.split('/').pop()}
          </span>
          {!readOnly && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs text-destructive hover:underline"
            >
              Remove
            </button>
          )}
        </div>
      ) : (
        <input
          type="file"
          accept={accept}
          disabled={readOnly || uploading}
          onChange={(e) => void handleFile(e)}
          className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
        />
      )}
      {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Geo sub-component ─────────────────────────────────────────────────────────

function GeoField({
  value,
  onChange,
  readOnly,
}: {
  componentId: string;
  value: GeoValue | null;
  onChange: (v: GeoValue | null) => void;
  readOnly: boolean;
}) {
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }
    setCapturing(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          captureMethod: 'gps',
          capturedAt: new Date().toISOString(),
        });
        setCapturing(false);
      },
      (err) => {
        setError(`Location error: ${err.message}`);
        setCapturing(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, [onChange]);

  return (
    <div className="space-y-2">
      {value ? (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs space-y-0.5">
          <p>
            <span className="text-muted-foreground">Lat:</span> {value.lat.toFixed(6)}
            &nbsp;&nbsp;
            <span className="text-muted-foreground">Lng:</span> {value.lng.toFixed(6)}
          </p>
          {value.accuracy && (
            <p className="text-muted-foreground">Accuracy: ±{Math.round(value.accuracy)}m</p>
          )}
          <p className="text-muted-foreground capitalize">{value.captureMethod.replace('_', ' ')}</p>
          {!readOnly && (
            <button
              type="button"
              onClick={() => void capture()}
              className="text-xs text-primary hover:underline"
            >
              Re-capture
            </button>
          )}
        </div>
      ) : (
        !readOnly && (
          <button
            type="button"
            onClick={() => void capture()}
            disabled={capturing}
            className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {capturing ? 'Capturing location…' : '📍 Capture GPS location'}
          </button>
        )
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Table sub-component ───────────────────────────────────────────────────────

function TableField({
  componentId,
  schema,
  value,
  onChange,
  lang,
  readOnly,
}: {
  componentId: string;
  schema: NonNullable<RendererComponent['tableSchema']>;
  value: TableRow[];
  onChange: (rows: TableRow[]) => void;
  lang: string;
  readOnly: boolean;
}) {
  function updateCell(rowIdx: number, colKey: string, cellVal: string | number | null) {
    const updated = value.map((row, i) =>
      i === rowIdx ? { ...row, [colKey]: cellVal } : row,
    );
    onChange(updated);
  }

  function addRow() {
    const empty: TableRow = {};
    schema.columns.forEach((c) => { empty[c.key] = null; });
    onChange([...value, empty]);
  }

  function removeRow(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {schema.columns.map((col) => (
              <th key={col.key} className="px-3 py-2 text-start text-xs font-medium">
                {label(col.label, lang)}
                {col.required && <span className="ms-1 text-destructive">*</span>}
              </th>
            ))}
            {!readOnly && <th className="w-10" />}
          </tr>
        </thead>
        <tbody className="divide-y">
          {value.length === 0 && (
            <tr>
              <td
                colSpan={schema.columns.length + (readOnly ? 0 : 1)}
                className="px-3 py-4 text-center text-xs text-muted-foreground"
              >
                No rows yet
              </td>
            </tr>
          )}
          {value.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {schema.columns.map((col) => (
                <td key={col.key} className="px-2 py-1">
                  {col.type === 'dropdown' && col.options ? (
                    <select
                      value={(row[col.key] as string) ?? ''}
                      disabled={readOnly}
                      className="w-full rounded border bg-background px-2 py-1 text-xs"
                      onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                    >
                      <option value="">—</option>
                      {col.options.map((o) => (
                        <option key={o.value} value={o.value}>{label(o.label, lang)}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                      value={(row[col.key] as string | number) ?? ''}
                      disabled={readOnly}
                      className="w-full rounded border bg-background px-2 py-1 text-xs"
                      onChange={(e) =>
                        updateCell(
                          rowIdx,
                          col.key,
                          col.type === 'number' && e.target.value !== ''
                            ? Number(e.target.value)
                            : e.target.value || null,
                        )
                      }
                    />
                  )}
                </td>
              ))}
              {!readOnly && (
                <td className="px-2 py-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(rowIdx)}
                    className="text-muted-foreground hover:text-destructive text-xs"
                  >
                    ×
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && schema.allow_add_rows !== false && (
        <div className="border-t px-3 py-2">
          <button
            type="button"
            onClick={addRow}
            disabled={schema.max_rows != null && value.length >= schema.max_rows}
            className="text-xs text-primary hover:underline disabled:opacity-40"
          >
            + Add row
          </button>
        </div>
      )}
    </div>
  );
}
