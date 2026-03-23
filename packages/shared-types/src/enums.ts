export enum NodeType {
  MINISTRY = 'ministry',
  REGION = 'region',
  DISTRICT = 'district',
  SCHOOL = 'school',
  OFFICE = 'office',
  UNIT = 'unit',
}

export enum EdgeType {
  HIERARCHICAL = 'hierarchical',
  PEER = 'peer',
  CROSS_FUNCTIONAL = 'cross_functional',
}

export enum Lang {
  EN = 'en',
  AR = 'ar',
  FR = 'fr',
  ES = 'es',
}

export enum ComponentType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  DATETIME = 'datetime',
  DROPDOWN = 'dropdown',
  MULTI_SELECT = 'multi_select',
  FILE_UPLOAD = 'file_upload',
  SIGNATURE = 'signature',
  GEO_COORDINATES = 'geo_coordinates',
  TABLE = 'table',
  SECTION = 'section',
  CONDITIONAL_GROUP = 'conditional_group',
}

export enum StepType {
  FILL = 'fill',
  REVIEW = 'review',
  APPROVE = 'approve',
  REJECT = 'reject',
  FORWARD = 'forward',
  NOTIFY = 'notify',
  END = 'end',
}

export enum NodeRelType {
  ABSOLUTE = 'absolute',
  PARENT = 'parent',
  ANCESTOR = 'ancestor',
  PEER = 'peer',
  CUSTOM = 'custom',
}

export enum TriggerAction {
  SUBMIT = 'submit',
  APPROVE = 'approve',
  REJECT = 'reject',
  FORWARD = 'forward',
  TIMEOUT = 'timeout',
}

export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  RECALLED = 'recalled',
  CLOSED = 'closed',
}

export enum AssignmentStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FORWARDED = 'forwarded',
  EXPIRED = 'expired',
  FLAGGED = 'flagged',
}

export enum SubmissionStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FLAGGED = 'flagged',
}

export enum ApprovalAction {
  SUBMIT = 'submit',
  APPROVE = 'approve',
  REJECT = 'reject',
  FORWARD = 'forward',
  REQUEST_CORRECTION = 'request_correction',
}

export enum PermissionAction {
  READ = 'read',
  WRITE = 'write',
  CREATE = 'create',
  DELETE = 'delete',
  APPROVE = 'approve',
  REJECT = 'reject',
  FORWARD = 'forward',
}

export enum SyncStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  ACCEPTED = 'accepted',
  FLAGGED = 'flagged',
  REJECTED = 'rejected',
}

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
}

export enum NotificationTrigger {
  ASSIGNMENT_CREATED = 'assignment_created',
  DEADLINE_APPROACHING = 'deadline_approaching',
  DEADLINE_PASSED = 'deadline_passed',
  SUBMISSION_RECEIVED = 'submission_received',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CAMPAIGN_RECALLED = 'campaign_recalled',
}
