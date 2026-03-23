'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useCampaigns,
  useCreateCampaign,
  type CampaignStatus,
} from '@/lib/api/hooks/use-campaigns';
import { useFormTemplates } from '@/lib/api/hooks/use-forms';
import { useXeduNodes } from '@/lib/api/hooks/use-xedu';

const STATUS_BADGE: Record<CampaignStatus, { label: string; classes: string }> = {
  draft: { label: 'Draft', classes: 'bg-gray-100 text-gray-700' },
  active: { label: 'Active', classes: 'bg-green-100 text-green-700' },
  paused: { label: 'Paused', classes: 'bg-yellow-100 text-yellow-700' },
  recalled: { label: 'Recalled', classes: 'bg-red-100 text-red-700' },
  closed: { label: 'Closed', classes: 'bg-slate-100 text-slate-600' },
};

const createSchema = z.object({
  titleEn: z.string().min(1, 'Title is required'),
  formTemplateId: z.string().uuid('Select a form template'),
  ownerNodeId: z.string().uuid('Select an owner node'),
  globalDeadline: z.string().optional(),
});

type CreateForm = z.infer<typeof createSchema>;

export default function CampaignsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | undefined>();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError } = useCampaigns({ page, limit: 20, status: statusFilter });
  const { data: templatesData } = useFormTemplates({ limit: 200 });
  const { data: nodesData } = useXeduNodes({ limit: 200 });
  const createCampaign = useCreateCampaign();

  const form = useForm<CreateForm>({ resolver: zodResolver(createSchema) });

  async function onSubmit(values: CreateForm) {
    await createCampaign.mutateAsync({
      title: { en: values.titleEn },
      formTemplateId: values.formTemplateId,
      ownerNodeId: values.ownerNodeId,
      globalDeadline: values.globalDeadline || undefined,
    });
    form.reset();
    setShowCreate(false);
  }

  const statuses: Array<CampaignStatus | undefined> = [
    undefined, 'draft', 'active', 'paused', 'recalled', 'closed',
  ];

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Deploy form templates to target nodes with assigned workflows
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {showCreate ? 'Cancel' : 'New campaign'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <h2 className="font-medium">New campaign</h2>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
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

            <div className="space-y-1">
              <label className="text-sm font-medium">Form template *</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                {...form.register('formTemplateId')}
              >
                <option value="">Select template…</option>
                {templatesData?.data.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.code}] {(t.title as Record<string, string>).en}
                    {t.currentVersion ? ` (v${t.currentVersion.versionNumber})` : ' — no published version'}
                  </option>
                ))}
              </select>
              {form.formState.errors.formTemplateId && (
                <p className="text-xs text-destructive">{form.formState.errors.formTemplateId.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Owner node *</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                {...form.register('ownerNodeId')}
              >
                <option value="">Select node…</option>
                {nodesData?.data.map((n) => (
                  <option key={n.id} value={n.id}>
                    [{n.code}] {(n.name as Record<string, string>).en} ({n.nodeType})
                  </option>
                ))}
              </select>
              {form.formState.errors.ownerNodeId && (
                <p className="text-xs text-destructive">{form.formState.errors.ownerNodeId.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Global deadline</label>
              <input
                type="datetime-local"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                {...form.register('globalDeadline')}
              />
            </div>

            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-md border px-4 py-2 text-sm hover:bg-accent">Cancel</button>
              <button type="submit" disabled={createCampaign.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {createCampaign.isPending ? 'Creating…' : 'Create campaign'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b">
        {statuses.map((s) => (
          <button
            key={s ?? 'all'}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-2 text-sm transition-colors border-b-2 -mb-px ${
              statusFilter === s
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {s ? STATUS_BADGE[s].label : 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-destructive">Failed to load campaigns</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-start font-medium">Title</th>
                <th className="px-4 py-3 text-start font-medium">Form</th>
                <th className="px-4 py-3 text-start font-medium">Status</th>
                <th className="px-4 py-3 text-start font-medium">Deadline</th>
                <th className="px-4 py-3 text-start font-medium">Nodes</th>
                <th className="px-4 py-3 text-start font-medium">Assignments</th>
                <th className="px-4 py-3 text-start font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No campaigns yet
                  </td>
                </tr>
              ) : (
                data?.data.map((c) => {
                  const badge = STATUS_BADGE[c.status];
                  return (
                    <tr key={c.id} className="hover:bg-muted/25">
                      <td className="px-4 py-3 font-medium">
                        {(c.title as Record<string, string>).en}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {c.formTemplate
                          ? `[${c.formTemplate.code}] ${(c.formTemplate.title as Record<string, string>).en}`
                          : '—'}
                        {c.formVersion && (
                          <span className="ms-1 text-muted-foreground/60">v{c.formVersion.versionNumber}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.classes}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {c.globalDeadline
                          ? new Date(c.globalDeadline).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {c._count?.workflowAssignments ?? 0}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {c._count?.submissionsAssignments ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/campaigns/${c.id}`} className="text-xs text-primary hover:underline">
                          Open →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-xs text-muted-foreground">
              Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} campaigns)
            </span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-3 py-1 text-xs disabled:opacity-40">Previous</button>
              <button disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border px-3 py-1 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
