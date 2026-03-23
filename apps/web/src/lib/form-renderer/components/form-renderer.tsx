'use client';

import { useState, useCallback } from 'react';
import type { RendererComponent, FieldValues, FieldValue } from '../types';
import { FieldRenderer } from './field-renderer';

interface FormRendererProps {
  components: RendererComponent[];
  initialValues?: FieldValues;
  onValuesChange?: (values: FieldValues) => void;
  onSaveDraft?: (values: FieldValues) => void;
  onSubmit?: (values: FieldValues, signatureImageBase64?: string, signatureTypedName?: string) => void;
  isSaving?: boolean;
  isSubmitting?: boolean;
  readOnly?: boolean;
  lang?: 'en' | 'ar' | 'fr' | 'es';
  showSubmitButton?: boolean;
}

function extractSignature(values: FieldValues): {
  signatureImageBase64?: string;
  signatureTypedName?: string;
  valuesWithoutSig: FieldValues;
} {
  const sig = Object.values(values).find(
    (v) => v && typeof v === 'object' && !Array.isArray(v) && 'mode' in (v as object),
  ) as { mode: 'drawn' | 'typed'; imageBase64?: string; typedName?: string } | undefined;

  return {
    signatureImageBase64: sig?.imageBase64,
    signatureTypedName: sig?.typedName,
    valuesWithoutSig: values,
  };
}

export function FormRenderer({
  components,
  initialValues = {},
  onValuesChange,
  onSaveDraft,
  onSubmit,
  isSaving = false,
  isSubmitting = false,
  readOnly = false,
  lang = 'en',
  showSubmitButton = true,
}: FormRendererProps) {
  const [values, setValues] = useState<FieldValues>(initialValues);

  const handleChange = useCallback(
    (componentId: string, value: FieldValue) => {
      setValues((prev) => {
        const next = { ...prev, [componentId]: value };
        onValuesChange?.(next);
        return next;
      });
    },
    [onValuesChange],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onSubmit) return;
    const { signatureImageBase64, signatureTypedName, valuesWithoutSig } = extractSignature(values);
    onSubmit(valuesWithoutSig, signatureImageBase64, signatureTypedName);
  }

  // Top-level components only (parentId === null / children handled by FieldRenderer)
  const rootComponents = components.filter((c) => !c.children?.length || c.type === 'section' || c.type === 'conditional_group')
    .filter((c) => {
      // Exclude children that appear in the flat list but are parented
      // (In the schema snapshot, children are nested; the flat API list shows parentId)
      return true;
    });

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <form onSubmit={handleSubmit} dir={dir} className="space-y-6">
      {rootComponents.map((component) => (
        <FieldRenderer
          key={component.id}
          component={component}
          values={values}
          onChange={handleChange}
          lang={lang}
          readOnly={readOnly}
        />
      ))}

      {!readOnly && (onSaveDraft || onSubmit) && showSubmitButton && (
        <div className="flex items-center gap-3 pt-4 border-t">
          {onSaveDraft && (
            <button
              type="button"
              onClick={() => onSaveDraft(values)}
              disabled={isSaving || isSubmitting}
              className="rounded-md border px-5 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save draft'}
            </button>
          )}
          {onSubmit && (
            <button
              type="submit"
              disabled={isSaving || isSubmitting}
              className="rounded-md bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting…' : 'Submit'}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
