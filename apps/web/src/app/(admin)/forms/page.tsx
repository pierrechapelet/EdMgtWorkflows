'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFormTemplates, useCreateFormTemplate } from '@/lib/api/hooks/use-forms';
import { useXeduNodes } from '@/lib/api/hooks/use-xedu';

const createSchema = z.object({
  code: z.string().min(1, 'Code is required').regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers, underscores'),
  titleEn: z.string().min(1, 'English title is required'),
  ownerNodeId: z.string().uuid('Select an organisation node'),
});

type CreateForm = z.infer<typeof createSchema>;

export default function FormsPage() {
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError } = useFormTemplates({ page, limit: 20 });
  const { data: nodesData } = useXeduNodes({ limit: 200 });
  const createTemplate = useCreateFormTemplate();

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  });

  async function onSubmit(values: CreateForm) {
    await createTemplate.mutateAsync({
      code: values.code,
      title: { en: values.titleEn },
      ownerNodeId: values.ownerNodeId,
    });
    form.reset();
    setShowCreate(false);
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Form Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage form templates and their versions
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {showCreate ? 'Cancel' : 'New template'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="font-medium">New form template</h2>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Code *</label>
              <input
                type="text"
                placeholder="e.g. student_enrollment"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                {...form.register('code')}
              />
              {form.formState.errors.code && (
                <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Title (English) *</label>
              <input
                type="text"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                {...form.register('titleEn')}
              />
              {form.formState.errors.titleEn && (
                <p className="text-xs text-destructive">{form.formState.errors.titleEn.message}</p>
              )}
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-sm font-medium">Owner node *</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                {...form.register('ownerNodeId')}
              >
                <option value="">Select organisation node…</option>
                {nodesData?.data.map((node) => (
                  <option key={node.id} value={node.id}>
                    [{node.code}] {(node.name as Record<string, string>).en ?? node.code} ({node.nodeType})
                  </option>
                ))}
              </select>
              {form.formState.errors.ownerNodeId && (
                <p className="text-xs text-destructive">{form.formState.errors.ownerNodeId.message}</p>
              )}
            </div>

            <div className="col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createTemplate.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {createTemplate.isPending ? 'Creating…' : 'Create template'}
              </button>
            </div>
          </form>
          {createTemplate.isError && (
            <p className="text-sm text-destructive">Failed to create template.</p>
          )}
        </div>
      )}

      {/* Templates table */}
      <div className="rounded-lg border">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-destructive">Failed to load templates</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-start font-medium">Code</th>
                <th className="px-4 py-3 text-start font-medium">Title</th>
                <th className="px-4 py-3 text-start font-medium">Owner node</th>
                <th className="px-4 py-3 text-start font-medium">Current version</th>
                <th className="px-4 py-3 text-start font-medium">Versions</th>
                <th className="px-4 py-3 text-start font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No templates yet
                  </td>
                </tr>
              ) : (
                data?.data.map((template) => (
                  <tr key={template.id} className="hover:bg-muted/25">
                    <td className="px-4 py-3 font-mono text-xs">{template.code}</td>
                    <td className="px-4 py-3 font-medium">
                      {(template.title as Record<string, string>).en}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {template.ownerNode
                        ? `[${template.ownerNode.code}] ${(template.ownerNode.name as Record<string, string>).en ?? ''}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {template.currentVersion ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          v{template.currentVersion.versionNumber}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {template._count?.versions ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/forms/${template.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-xs text-muted-foreground">
              Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} templates)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border px-3 py-1 text-xs disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border px-3 py-1 text-xs disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
