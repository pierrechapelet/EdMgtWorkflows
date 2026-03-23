'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useWorkflows, useCreateWorkflow } from '@/lib/api/hooks/use-workflows';
import { useXeduNodes } from '@/lib/api/hooks/use-xedu';

const createSchema = z.object({
  nameEn: z.string().min(1, 'Name is required'),
  ownerNodeId: z.string().uuid('Select an organisation node'),
});

type CreateForm = z.infer<typeof createSchema>;

export default function WorkflowsPage() {
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError } = useWorkflows({ page, limit: 20 });
  const { data: nodesData } = useXeduNodes({ limit: 200 });
  const createWorkflow = useCreateWorkflow();

  const form = useForm<CreateForm>({ resolver: zodResolver(createSchema) });

  async function onSubmit(values: CreateForm) {
    await createWorkflow.mutateAsync({
      name: { en: values.nameEn },
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
          <h1 className="text-2xl font-semibold">Workflow Definitions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Design approval and routing workflows for form campaigns
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {showCreate ? 'Cancel' : 'New workflow'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="font-medium">New workflow definition</h2>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name (English) *</label>
              <input
                type="text"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                {...form.register('nameEn')}
              />
              {form.formState.errors.nameEn && (
                <p className="text-xs text-destructive">{form.formState.errors.nameEn.message}</p>
              )}
            </div>

            <div className="space-y-1">
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
                disabled={createWorkflow.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {createWorkflow.isPending ? 'Creating…' : 'Create workflow'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Workflows table */}
      <div className="rounded-lg border">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-destructive">Failed to load workflows</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-start font-medium">Name</th>
                <th className="px-4 py-3 text-start font-medium">Owner node</th>
                <th className="px-4 py-3 text-start font-medium">Steps</th>
                <th className="px-4 py-3 text-start font-medium">Status</th>
                <th className="px-4 py-3 text-start font-medium">Created by</th>
                <th className="px-4 py-3 text-start font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No workflows yet
                  </td>
                </tr>
              ) : (
                data?.data.map((wf) => (
                  <tr key={wf.id} className="hover:bg-muted/25">
                    <td className="px-4 py-3 font-medium">
                      {(wf.name as Record<string, string>).en}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {wf.ownerNode
                        ? `[${wf.ownerNode.code}] ${(wf.ownerNode.name as Record<string, string>).en ?? ''}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {wf._count?.steps ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      {wf.isPublished ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Published
                        </span>
                      ) : (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {wf.createdBy?.email ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/workflows/${wf.id}`}
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
              Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} workflows)
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
