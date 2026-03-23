'use client';

import { use } from 'react';
import Link from 'next/link';
import { useFormTemplate, useCreateFormVersion, usePublishFormVersion } from '@/lib/api/hooks/use-forms';

export default function FormTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: template, isLoading, isError } = useFormTemplate(id);
  const createVersion = useCreateFormVersion(id);
  const publishVersion = usePublishFormVersion(id);

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }
  if (isError || !template) {
    return <div className="p-8 text-sm text-destructive">Failed to load template</div>;
  }

  const draftVersion = template.versions?.find((v) => v.isDraft);
  const publishedVersions = template.versions?.filter((v) => v.isPublished) ?? [];

  return (
    <div className="p-8 space-y-6">
      {/* Breadcrumb */}
      <div className="text-xs text-muted-foreground">
        <Link href="/admin/forms" className="hover:underline">Forms</Link>
        {' / '}
        <span>{(template.title as Record<string, string>).en}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {(template.title as Record<string, string>).en}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-mono">{template.code}</p>
          {template.ownerNode && (
            <p className="text-xs text-muted-foreground mt-1">
              Owner: [{template.ownerNode.code}]{' '}
              {(template.ownerNode.name as Record<string, string>).en} ({template.ownerNode.nodeType})
            </p>
          )}
        </div>

        <button
          onClick={() => createVersion.mutate({})}
          disabled={createVersion.isPending || !!draftVersion}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          title={draftVersion ? 'A draft version already exists' : 'Create new version'}
        >
          {createVersion.isPending ? 'Creating…' : 'New version'}
        </button>
      </div>

      {/* Draft version banner */}
      {draftVersion && (
        <div className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
          <div>
            <span className="text-sm font-medium text-yellow-800">
              Draft v{draftVersion.versionNumber} — not yet published
            </span>
            <p className="text-xs text-yellow-700 mt-0.5">
              Edit the form builder, then publish to make it available for campaigns.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/admin/forms/${id}/versions/${draftVersion.id}`}
              className="rounded-md border border-yellow-400 bg-white px-3 py-1.5 text-xs font-medium text-yellow-800 hover:bg-yellow-50"
            >
              Edit builder
            </Link>
            <button
              onClick={() => publishVersion.mutate(draftVersion.id)}
              disabled={publishVersion.isPending}
              className="rounded-md bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
            >
              {publishVersion.isPending ? 'Publishing…' : 'Publish'}
            </button>
          </div>
        </div>
      )}

      {/* Versions list */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Published versions</h2>
        {publishedVersions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No published versions yet.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {publishedVersions.map((v) => (
              <div key={v.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    v{v.versionNumber}
                  </span>
                  {template.currentVersionId === v.id && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Current
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Published {v.publishedAt ? new Date(v.publishedAt).toLocaleDateString() : '—'}
                  </span>
                </div>
                <Link
                  href={`/admin/forms/${id}/versions/${v.id}`}
                  className="text-xs text-primary hover:underline"
                >
                  View →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
