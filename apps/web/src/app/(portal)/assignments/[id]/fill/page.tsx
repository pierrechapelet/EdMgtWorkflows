'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMyAssignment } from '@/lib/api/hooks/use-campaigns';
import { useDraft, useSaveDraft, useSubmitSubmission, inflateValues } from '@/lib/api/hooks/use-submissions';
import { FormRenderer } from '@/lib/form-renderer/components/form-renderer';
import { saveLocalDraft, getLocalDraft, syncPendingDrafts } from '@/lib/offline/sync-manager';
import type { RendererComponent, FieldValues } from '@/lib/form-renderer/types';
import type { SignatureValue } from '@/lib/signature/components/signature-pad';

const AUTOSAVE_DEBOUNCE_MS = 3_000;

export default function FillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: assignmentId } = use(params);
  const router = useRouter();

  // Data
  const { data: assignment, isLoading: assignmentLoading } = useMyAssignment(assignmentId);
  const { data: draft, isLoading: draftLoading } = useDraft(assignmentId);
  const saveDraft = useSaveDraft(assignmentId);
  const submitSubmission = useSubmitSubmission(assignmentId);

  // Local state
  const [isOnline, setIsOnline] = useState(true);
  const [localSaveStatus, setLocalSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'offline-saved'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [autosaveTimer, setAutosaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Attempt to sync pending drafts when coming back online
      const token = localStorage.getItem('access_token') ?? '';
      void syncPendingDrafts(token).then((summary) => {
        if (summary.synced > 0) {
          void saveDraft.mutateAsync({} as FieldValues); // re-query
        }
      });
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleValuesChange = useCallback(
    (values: FieldValues) => {
      // Debounced autosave
      if (autosaveTimer) clearTimeout(autosaveTimer);
      const timer = setTimeout(() => {
        void handleSaveDraft(values);
      }, AUTOSAVE_DEBOUNCE_MS);
      setAutosaveTimer(timer);
    },
    [autosaveTimer], // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function handleSaveDraft(values: FieldValues) {
    setLocalSaveStatus('saving');

    if (!isOnline) {
      // Save to IndexedDB
      await saveLocalDraft({
        assignmentId,
        values: Object.entries(values).map(([componentId, v]) => ({
          componentId,
          ...(typeof v === 'string' ? { valueText: v } : {}),
          ...(typeof v === 'number' ? { valueNumber: v } : {}),
          ...(typeof v === 'object' && v !== null && !Array.isArray(v)
            ? { valueJson: v as Record<string, unknown> }
            : {}),
          ...(Array.isArray(v) ? { valueJson: { items: v } } : {}),
        })),
        pendingSubmit: false,
      });
      setLocalSaveStatus('offline-saved');
      return;
    }

    try {
      await saveDraft.mutateAsync(values);
      setLocalSaveStatus('saved');
      setTimeout(() => setLocalSaveStatus('idle'), 2000);
    } catch {
      setLocalSaveStatus('idle');
    }
  }

  async function handleSubmit(
    values: FieldValues,
    signatureImageBase64?: string,
    signatureTypedName?: string,
  ) {
    setSubmitError(null);

    if (!isOnline) {
      // Queue for background sync
      await saveLocalDraft({
        assignmentId,
        values: Object.entries(values).map(([componentId, v]) => ({
          componentId,
          ...(typeof v === 'string' ? { valueText: v } : {}),
          ...(typeof v === 'number' ? { valueNumber: v } : {}),
          ...(typeof v === 'object' && v !== null && !Array.isArray(v)
            ? { valueJson: v as Record<string, unknown> }
            : {}),
          ...(Array.isArray(v) ? { valueJson: { items: v } } : {}),
        })),
        signatureImageBase64,
        signatureTypedName,
        pendingSubmit: true,
      });
      setShowSuccessModal(true);
      return;
    }

    try {
      const sig: SignatureValue | null = signatureImageBase64
        ? { mode: 'drawn', imageBase64: signatureImageBase64 }
        : signatureTypedName
          ? { mode: 'typed', typedName: signatureTypedName }
          : null;

      await submitSubmission.mutateAsync({ values, signature: sig });
      setShowSuccessModal(true);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Submission failed. Please try again.';
      setSubmitError(msg);
    }
  }

  // Loading states
  if (assignmentLoading || draftLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading form…</div>;
  }
  if (!assignment) {
    return <div className="p-8 text-sm text-destructive">Assignment not found</div>;
  }

  // Campaign guards
  if (assignment.campaign?.status === 'recalled') {
    return (
      <div className="p-8 space-y-3">
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <h2 className="font-semibold text-red-800">Campaign recalled</h2>
          <p className="text-sm text-red-700 mt-1">
            This campaign has been recalled. No further submissions are accepted.
          </p>
        </div>
        <Link href="/portal/assignments" className="text-sm text-primary hover:underline">
          ← Back to assignments
        </Link>
      </div>
    );
  }

  if (!['pending', 'in_progress'].includes(assignment.status)) {
    return (
      <div className="p-8 space-y-3">
        <div className="rounded-md border bg-muted/40 p-4">
          <p className="text-sm text-muted-foreground">
            This assignment is <strong>{assignment.status}</strong> and cannot be edited.
          </p>
        </div>
        <Link href="/portal/assignments" className="text-sm text-primary hover:underline">
          ← Back
        </Link>
      </div>
    );
  }

  // Derive form components from schema snapshot
  const schema = assignment.campaign?.formVersion?.schema as { children?: RendererComponent[] } | null;
  const components: RendererComponent[] = Array.isArray(schema) ? schema : schema?.children ?? [];

  // Initialise values from server draft if present
  const initialValues = draft?.values ? inflateValues(draft.values) : {};

  const titleEn = assignment.campaign?.title
    ? (assignment.campaign.title as Record<string, string>).en
    : 'Form';

  const stepName = assignment.workflowStep?.name
    ? (assignment.workflowStep.name as Record<string, string>).en
    : assignment.workflowStep?.stepType ?? '';

  return (
    <div className="min-h-screen bg-background">
      {/* Success modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-xl space-y-4 mx-4">
            <div className="text-center space-y-2">
              <div className="text-4xl">✅</div>
              <h2 className="text-lg font-semibold">
                {isOnline ? 'Submitted successfully' : 'Saved for sync'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isOnline
                  ? 'Your submission has been received.'
                  : 'Your submission is saved locally and will be sent when you reconnect.'}
              </p>
            </div>
            <button
              onClick={() => router.push('/portal/assignments')}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Back to assignments
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b bg-card px-6 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-semibold truncate">{titleEn}</h1>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs shrink-0">
                {stepName}
              </span>
            </div>
            {assignment.deadline && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Deadline: {new Date(assignment.deadline).toLocaleString()}
              </p>
            )}
          </div>

          {/* Online / offline indicator */}
          <div className="flex items-center gap-2 shrink-0">
            {!isOnline && (
              <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                Offline
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {localSaveStatus === 'saving' && 'Saving…'}
              {localSaveStatus === 'saved' && '✓ Saved'}
              {localSaveStatus === 'offline-saved' && '✓ Saved locally'}
            </span>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        {submitError && (
          <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {submitError}
          </div>
        )}

        {components.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-muted-foreground text-sm">
            This form has no components defined yet.
          </div>
        ) : (
          <FormRenderer
            components={components}
            initialValues={initialValues}
            onValuesChange={handleValuesChange}
            onSaveDraft={(values) => void handleSaveDraft(values)}
            onSubmit={(values, sigImage, sigName) => void handleSubmit(values, sigImage, sigName)}
            isSaving={saveDraft.isPending || localSaveStatus === 'saving'}
            isSubmitting={submitSubmission.isPending}
          />
        )}
      </main>
    </div>
  );
}
