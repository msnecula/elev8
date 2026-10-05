import type { UserRole } from '@/types/auth';

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Elev8 Comply';
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
export const ALLOWED_NOTICE_MIME_TYPES = ['application/pdf'];
export const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const STORAGE_BUCKET_NOTICES = 'notices';
export const STORAGE_BUCKET_ATTACHMENTS = 'attachments';
export const STORAGE_BUCKET_COMPLETION_PHOTOS = 'completion-photos';

export const FORTY_EIGHT_HOUR_ALERT_THRESHOLD_HOURS = 24;
export const FORTY_EIGHT_HOUR_REQUIRED_HOURS = 48;
export const PROPOSAL_EXPIRY_DAYS = 30;
export const DEFAULT_PAGE_SIZE = 20;

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  reviewer: 'Reviewer',
  dispatcher: 'Dispatcher',
  technician: 'Technician',
  client: 'Client',
};

export const JOB_STAGE_LABELS: Record<string, string> = {
  notice_received: 'Notice Received',
  under_review: 'Under Review',
  proposal_drafted: 'Proposal Drafted',
  proposal_sent: 'Proposal Sent',
  approved: 'Approved',
  scheduled: 'Scheduled',
  dispatched: 'Dispatched',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  on_hold: 'On Hold',
};

export const WORK_ORDER_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  assigned: 'Assigned',
  dispatched: 'Dispatched',
  ready: 'Ready',
  en_route: 'En Route',
  on_site: 'On Site',
  completed: 'Completed',
  held: 'Held',
  cancelled: 'Cancelled',
};

export const URGENCY_LABELS: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const NOTICE_STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  parsing: 'Parsing',
  parsed: 'Parsed',
  parse_failed: 'Parse Failed',
  review_pending: 'Review Pending',
  reviewed: 'Reviewed',
};

export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  approved: 'Approved',
  rejected: 'Rejected',
  revision_requested: 'Revision Requested',
  expired: 'Expired',
};

export const SKILL_TAGS = [
  'hydraulic',
  'traction',
  'mrl',
  'escalator',
  'dumbwaiter',
  'residential',
  'commercial',
  'modernization',
  'inspection',
  'compliance',
] as const;

export type SkillTag = (typeof SKILL_TAGS)[number];

export const REGIONS = [
  'Los Angeles',
  'Orange County',
  'San Diego',
  'Riverside',
  'San Bernardino',
  'Ventura',
  'Santa Barbara',
] as const;

export type Region = (typeof REGIONS)[number];
