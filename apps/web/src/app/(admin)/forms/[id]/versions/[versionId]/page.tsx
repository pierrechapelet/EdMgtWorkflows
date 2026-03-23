'use client';

import { use, useState, useCallback } from 'react';
import Link from 'next/link';
import { useFormVersion } from '@/lib/api/hooks/use-forms';
import { FormBuilder } from '@/lib/form-builder/components/form-builder';
import type { FormComponentDef } from '@/lib/form-builder/types';
import { apiClient } from '@/lib/api/client';
import { useQueryClient } from '@tanstack/react-query';

export default function FormVersionBuilderPage({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>;
}) {
  const { id, versionId } = use(params);
  const queryClient = useQueryClient();
  const { data: version, isLoading, isError } = useFormVersion(id, versionId);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = useCallback(
    async (components: FormComponentDef[]) => {
      if (!version) return;
      setSaveError(null);
      setIsSaving(true);

      try {
        // Sync component changes: delete all + re-create is complex;
        // instead we batch update/create/delete by diffing against server state.
        // For simplicity in this phase we use a bulk reorder + individual upserts.
        const existing = version.components ?? [];
        const existingIds = new Set(existing.map((c) => c.id));
        const newIds = new Set(components.map((c) => c.id));

        // Delete removed components
        const toDelete = existing.filter((c) => !newIds.has(c.id));
        for (const c of toDelete) {
          await apiClient.delete(
            `/forms/templates/${id}/versions/${versionId}/components/${c.id}`,
          );
        }

        // Create new or update existing
        for (const component of components) {
          const { id: componentId, children: _children, ...rest } = component;
          if (!existingIds.has(componentId)) {
            // New component — POST (server assigns ID, but we pass the local one for reference)
            await apiClient.post(
              `/forms/templates/${id}/versions/${versionId}/components`,
              rest,
            );
          } else {
            // Existing — PATCH
            await apiClient.patch(
              `/forms/templates/${id}/versions/${versionId}/components/${componentId}`,
              rest,
            );
          }
        }

        // Reorder
        if (components.length > 0) {
          await apiClient.put(
            `/forms/templates/${id}/versions/${versionId}/components/reorder`,
            { orderedIds: components.filter((c) => c.parentId === null).map((c) => c.id) },
          );
        }

        void queryClient.invalidateQueries({ queryKey: ['form-version', id, versionId] });
      } catch {
        setSaveError('Failed to save. Please try again.');
      } finally {
        setIsSaving(false);
      }
    },
    [id, versionId, version, queryClient],
  );

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }
  if (isError || !version) {
    return <div className="p-8 text-sm text-destructive">Failed to load version</div>;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-4 border-b px-6 py-3 bg-card shrink-0">
        <Link href={`/admin/forms/${id}`} className="text-xs text-muted-foreground hover:underline">
          ← Back
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Form builder</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
            v{version.versionNumber}
          </span>
          {version.isDraft ? (
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
              Draft
            </span>
          ) : (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
              Published
            </span>
          )}
        </div>
        {saveError && (
          <span className="ms-auto text-xs text-destructive">{saveError}</span>
        )}
      </header>

      {/* Builder */}
      <div className="flex-1 overflow-hidden">
        <FormBuilder
          initialComponents={version.components ?? []}
          onSave={handleSave}
          isSaving={isSaving}
          readOnly={!version.isDraft}
        />
      </div>
    </div>
  );
}
