export * from './enums';

// ─── Common types ─────────────────────────────────────────────────────────────

/** All user-visible strings stored as multilingual JSONB */
export type MultilingualString = {
  en?: string;
  ar?: string;
  fr?: string;
  es?: string;
};

/** Standard API response envelope */
export type ApiResponse<T> = {
  data: T;
  meta?: ApiMeta;
};

export type ApiMeta = {
  total?: number;
  page?: number;
  limit?: number;
  cursor?: string;
  [key: string]: unknown;
};

export type ApiError = {
  code: string;
  message: string;
  i18nKey: string;
};

// ─── Pagination ───────────────────────────────────────────────────────────────

export type CursorPaginationParams = {
  cursor?: string;
  limit?: number;
};

export type OffsetPaginationParams = {
  page?: number;
  limit?: number;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type JwtPayload = {
  sub: string;       // userId
  mfaPending?: boolean;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export type MfaChallengeResponse = {
  mfaRequired: true;
  mfaToken: string;  // short-lived JWT with mfaPending=true
};

export type LoginResponse = TokenPair | MfaChallengeResponse;

// ─── User context (attached to request by JWT guard) ──────────────────────────

export type RequestUser = {
  id: string;
  email: string;
  preferredLang: string;
  mfaEnabled: boolean;
  roleAssignments: Array<{
    role: { id: string; code: string };
    xeduNode: { id: string; code: string; nodeType: string };
    validFrom: Date;
    validUntil: Date | null;
  }>;
};

// ─── Permission resolution ────────────────────────────────────────────────────

export type PermissionQuery = {
  userId: string;
  action: import('./enums').PermissionAction;
  componentId?: string;
  workflowStepId?: string;
  formTemplateId?: string;
};

export type PermissionResult = {
  granted: boolean;
  reason?: string;
};

// ─── Form schema types (mirrors form-schema package validators) ────────────────

export type TableColumn = {
  key: string;
  label: MultilingualString;
  type: import('./enums').ComponentType;
  required?: boolean;
  options?: Array<{ value: string; label: MultilingualString }>;
};

export type TableSchema = {
  allowAddRows?: boolean;
  maxRows?: number;
  columns: TableColumn[];
};

export type ValidationRules = {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  accept?: string;   // MIME types for file_upload
  maxSize?: number;  // bytes
};

export type ConditionalRule = {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in' | 'not_in';
  value: unknown;
  logicGroup?: 'and' | 'or';
};

// ─── Offline sync ─────────────────────────────────────────────────────────────

export type SyncPayload = {
  localSubmissionId: string;
  assignmentId: string;
  formVersionId: string;
  values: Array<{
    componentId: string;
    valueText?: string;
    valueNumber?: number;
    valueDate?: string;
    valueJson?: unknown;
    valueFileKey?: string;
  }>;
  geoPoints?: Array<{
    componentId: string;
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    captureMethod: 'gps' | 'map_selection';
    capturedAt: string;
  }>;
  signatureHash?: string;
  submittedAt: string;
  deviceId: string;
};

export type SyncConflict =
  | { type: 'CAMPAIGN_RECALLED'; campaignId: string }
  | { type: 'DEADLINE_PASSED'; deadline: string; submittedAt: string }
  | { type: 'VERSION_MISMATCH'; expected: string; received: string };

export type SyncResult = {
  status: 'accepted' | 'flagged';
  submissionId?: string;
  conflicts?: SyncConflict[];
};
