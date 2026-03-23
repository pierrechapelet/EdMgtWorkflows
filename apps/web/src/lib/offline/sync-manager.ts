/**
 * Offline sync manager — runs when connectivity is restored.
 *
 * Strategy:
 * 1. Collect all drafts with syncStatus = 'pending' from IndexedDB
 * 2. POST /sync/submissions to the server
 * 3. For each result:
 *    - 'synced' → mark draft as synced (or delete if submitted)
 *    - 'flagged' → store conflict flags, surface to user
 *    - 'error' → keep pending for retry
 */

import { offlineDb, type DraftEntry } from './db';

export interface SyncSummary {
  synced: number;
  flagged: number;
  errors: number;
}

export async function syncPendingDrafts(
  accessToken: string,
  apiBase = '',
): Promise<SyncSummary> {
  const pending = await offlineDb.drafts
    .where('syncStatus')
    .equals('pending')
    .toArray();

  if (pending.length === 0) return { synced: 0, flagged: 0, errors: 0 };

  const deviceId = getOrCreateDeviceId();

  const payload = {
    submissions: pending.map((d) => ({
      assignmentId: d.assignmentId,
      deviceId,
      clientTimestamp: d.updatedAt,
      values: d.values,
      signatureImageBase64: d.signatureImageBase64,
      signatureTypedName: d.signatureTypedName,
      submit: d.pendingSubmit,
    })),
  };

  let results: Array<{
    assignmentId: string;
    status: 'synced' | 'flagged' | 'error';
    submissionId?: string;
    flags: string[];
    message?: string;
  }>;

  try {
    const res = await fetch(`${apiBase}/sync/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const body = (await res.json()) as { data: typeof results };
    results = body.data;
  } catch {
    // Network still down — keep all pending
    return { synced: 0, flagged: 0, errors: pending.length };
  }

  let synced = 0, flagged = 0, errors = 0;

  for (const result of results) {
    const draft = pending.find((d) => d.assignmentId === result.assignmentId);
    if (!draft?.id) continue;

    if (result.status === 'synced') {
      if (draft.pendingSubmit) {
        await offlineDb.drafts.delete(draft.id);
      } else {
        await offlineDb.drafts.update(draft.id, { syncStatus: 'synced' });
      }
      synced++;
    } else if (result.status === 'flagged') {
      await offlineDb.drafts.update(draft.id, {
        syncStatus: 'conflict',
        conflictFlags: result.flags,
      });
      flagged++;
    } else {
      await offlineDb.drafts.update(draft.id, { syncStatus: 'error' });
      errors++;
    }
  }

  return { synced, flagged, errors };
}

/** Save or update a draft in IndexedDB */
export async function saveLocalDraft(
  draft: Omit<DraftEntry, 'id' | 'syncStatus' | 'updatedAt'>,
): Promise<void> {
  const existing = await offlineDb.drafts
    .where('assignmentId')
    .equals(draft.assignmentId)
    .first();

  const entry: DraftEntry = {
    ...draft,
    syncStatus: 'pending',
    updatedAt: new Date().toISOString(),
  };

  if (existing?.id) {
    await offlineDb.drafts.update(existing.id, entry);
  } else {
    await offlineDb.drafts.add(entry);
  }
}

/** Get local draft for a given assignment */
export async function getLocalDraft(assignmentId: string): Promise<DraftEntry | undefined> {
  return offlineDb.drafts.where('assignmentId').equals(assignmentId).first();
}

/** Register a Background Sync task (if the browser supports it) */
export async function registerBackgroundSync(): Promise<void> {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await (reg as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-drafts');
    } catch {
      // Not supported or permission denied — fall back to online event listener
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOrCreateDeviceId(): string {
  const key = 'edmgt_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
