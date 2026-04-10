import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['admin', 'reviewer', 'dispatcher', 'technician', 'client']);
export const buildingTypeEnum = pgEnum('building_type', ['residential', 'commercial', 'mixed_use']);
export const urgencyEnum = pgEnum('urgency', ['critical', 'high', 'medium', 'low']);
export const noticeStatusEnum = pgEnum('notice_status', ['received', 'parsing', 'parsed', 'parse_failed', 'review_pending', 'reviewed']);
export const noticeIntakeMethodEnum = pgEnum('notice_intake_method', ['portal_upload', 'email_intake', 'manual']);
export const jobStageEnum = pgEnum('job_stage', ['notice_received', 'under_review', 'proposal_drafted', 'proposal_sent', 'approved', 'scheduled', 'dispatched', 'in_progress', 'completed', 'cancelled', 'on_hold']);
export const proposalStatusEnum = pgEnum('proposal_status', ['draft', 'sent', 'approved', 'rejected', 'revision_requested', 'expired']);
export const schedulingRequestStatusEnum = pgEnum('scheduling_request_status', ['pending', 'confirmed', 'rescheduled', 'cancelled']);
export const workOrderStatusEnum = pgEnum('work_order_status', ['draft', 'assigned', 'dispatched', 'ready', 'en_route', 'on_site', 'completed', 'held', 'cancelled']);
export const fortyEightHourStatusEnum = pgEnum('forty_eight_hour_status', ['not_required', 'pending', 'sent', 'overdue']);
export const complianceNoticeStatusEnum = pgEnum('compliance_notice_status', ['draft', 'sent', 'acknowledged']);
export const entityTypeEnum = pgEnum('entity_type', ['notice', 'job', 'work_order', 'proposal', 'compliance_notice', 'scheduling_request']);
export const activityEventTypeEnum = pgEnum('activity_event_type', [
  'notice_received', 'notice_parsing_started', 'notice_parsed', 'notice_parse_failed',
  'job_created', 'job_stage_changed', 'reviewer_assigned',
  'proposal_drafted', 'proposal_sent', 'proposal_approved', 'proposal_rejected', 'revision_requested',
  'scheduling_requested', 'date_confirmed',
  'forty_eight_hour_drafted', 'forty_eight_hour_sent', 'forty_eight_hour_overdue',
  'work_order_created', 'technician_assigned', 'work_order_dispatched',
  'technician_status_updated', 'work_completed', 'escalation_triggered',
  'note_added', 'file_uploaded',
]);
export const notificationTypeEnum = pgEnum('notification_type', ['email', 'sms', 'in_app']);
export const notificationStatusEnum = pgEnum('notification_status', ['pending', 'sent', 'failed']);
