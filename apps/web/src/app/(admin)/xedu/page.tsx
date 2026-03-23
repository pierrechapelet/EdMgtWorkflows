'use client';

import { useState } from 'react';
import { useXeduNodes, useCreateXeduNode } from '@/lib/api/hooks/use-xedu';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const NODE_TYPES = ['ministry', 'region', 'district', 'school', 'office', 'unit'] as const;

const createNodeSchema = z.object({
  nodeType: z.enum(NODE_TYPES),
  nameEn: z.string().min(1, 'English name is required'),
  nameAr: z.string().optional(),
  nameFr: z.string().optional(),
  nameEs: z.string().optional(),
});

type CreateNodeForm = z.infer<typeof createNodeSchema>;

export default function XeduPage() {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError } = useXeduNodes({ search: search || undefined, limit: 50 });
  const createNode = useCreateXeduNode();

  const form = useForm<CreateNodeForm>({
    resolver: zodResolver(createNodeSchema),
    defaultValues: { nodeType: 'school' },
  });

  async function onSubmit(values: CreateNodeForm) {
    await createNode.mutateAsync({
      nodeType: values.nodeType,
      name: {
        en: values.nameEn,
        ...(values.nameAr && { ar: values.nameAr }),
        ...(values.nameFr && { fr: values.nameFr }),
        ...(values.nameEs && { es: values.nameEs }),
      },
    });
    form.reset();
    setShowCreate(false);
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Organisational Structure</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the Xedu administrative graph
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {showCreate ? 'Cancel' : 'Add node'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="font-medium">New Xedu node</h2>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-sm font-medium">Node type</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                {...form.register('nodeType')}
              >
                {NODE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {[
              { field: 'nameEn' as const, label: 'Name (English) *' },
              { field: 'nameAr' as const, label: 'Name (Arabic)' },
              { field: 'nameFr' as const, label: 'Name (French)' },
              { field: 'nameEs' as const, label: 'Name (Spanish)' },
            ].map(({ field, label }) => (
              <div key={field} className="space-y-1">
                <label className="text-sm font-medium">{label}</label>
                <input
                  type="text"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  dir={field === 'nameAr' ? 'rtl' : 'ltr'}
                  {...form.register(field)}
                />
                {form.formState.errors[field] && (
                  <p className="text-xs text-destructive">{form.formState.errors[field]?.message}</p>
                )}
              </div>
            ))}

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
                disabled={createNode.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {createNode.isPending ? 'Creating…' : 'Create node'}
              </button>
            </div>
          </form>
          {createNode.isError && (
            <p className="text-sm text-destructive">Failed to create node. Check console.</p>
          )}
        </div>
      )}

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search nodes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Nodes table */}
      <div className="rounded-lg border">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-destructive">Failed to load nodes</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-start font-medium">Code</th>
                <th className="px-4 py-3 text-start font-medium">Type</th>
                <th className="px-4 py-3 text-start font-medium">Name (EN)</th>
                <th className="px-4 py-3 text-start font-medium">Name (AR)</th>
                <th className="px-4 py-3 text-start font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No nodes found
                  </td>
                </tr>
              ) : (
                data?.data.map((node) => (
                  <tr key={node.id} className="hover:bg-muted/25">
                    <td className="px-4 py-3 font-mono text-xs">{node.code}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                        {node.nodeType}
                      </span>
                    </td>
                    <td className="px-4 py-3">{(node.name as Record<string, string>).en ?? '—'}</td>
                    <td className="px-4 py-3" dir="rtl">{(node.name as Record<string, string>).ar ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          node.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {node.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
        {data && (
          <div className="border-t px-4 py-3 text-xs text-muted-foreground">
            {data.meta.total} nodes total
          </div>
        )}
      </div>
    </div>
  );
}
