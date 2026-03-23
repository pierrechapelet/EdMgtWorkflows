import Dexie, { type Table } from 'dexie';

export interface DraftEntry {
  id?: number;           // IndexedDB auto-increment PK
  assignmentId: string;
  values: Array<{
    componentId: string;
    valueText?: string;
    valueNumber?: number;
    valueDate?: string;
    valueJson?: Record<string, unknown>;
    valueFileKey?: string;
  }>;
  signatureImageBase64?: string;
  signatureTypedName?: string;
  /** True when the user hit Submit but we're offline */
  pendingSubmit: boolean;
  updatedAt: string;      // ISO timestamp
  syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  conflictFlags?: string[];
}

class OfflineDb extends Dexie {
  drafts!: Table<DraftEntry>;

  constructor() {
    super('EdMgtOffline');
    this.version(1).stores({
      drafts: '++id, assignmentId, syncStatus, updatedAt',
    });
  }
}

export const offlineDb = new OfflineDb();
