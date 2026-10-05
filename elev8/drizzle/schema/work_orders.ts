import { pgTable, uuid, varchar, text, boolean, timestamp, date, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { schedulingRequestStatusEnum, workOrderStatusEnum, fortyEightHourStatusEnum, complianceNoticeStatusEnum } from './enums';
import { jobs } from './jobs';
import { users } from './users';

// ─── Scheduling Requests ─────────────────────────────────────────────────────
export const schedulingRequests = pgTable('scheduling_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
  confirmedBy: uuid('confirmed_by').references(() => users.id, { onDelete: 'set null' }),
  status: schedulingRequestStatusEnum('status').notNull().default('pending'),
  preferredDate1: date('preferred_date_1'),
  preferredDate2: date('preferred_date_2'),
  preferredDate3: date('preferred_date_3'),
  notes: text('notes'),
  confirmedStartDate: timestamp('confirmed_start_date', { withTimezone: true }),
  confirmedEndDate: timestamp('confirmed_end_date', { withTimezone: true }),
  buildingAccessNotes: text('building_access_notes'),
  complianceCoordinationNotes: text('compliance_coordination_notes'),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  jobIdIdx: index('scheduling_requests_job_id_idx').on(t.jobId),
  statusIdx: index('scheduling_requests_status_idx').on(t.status),
}));

// ─── Technicians ─────────────────────────────────────────────────────────────
export const technicians = pgTable('technicians', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  employeeId: varchar('employee_id', { length: 50 }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  skillTags: text('skill_tags').array().default([]).notNull(),
  regions: text('regions').array().default([]).notNull(),
  isAvailable: boolean('is_available').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdUnique: uniqueIndex('technicians_user_id_unique').on(t.userId),
  isAvailableIdx: index('technicians_is_available_idx').on(t.isAvailable),
}));

// ─── Work Orders ──────────────────────────────────────────────────────────────
export type DispatchPacket = {
  propertyName: string;
  propertyAddress: string;
  buildingType: string;
  elevatorCount: number;
  contactName: string;
  contactPhone: string;
  buildingAccessNotes: string;
  requiredScope: string;
  violationItems: string[];
  specialInstructions: string;
  complianceNotes: string;
  requiredSkillTag: string;
};

export const workOrders = pgTable('work_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  schedulingRequestId: uuid('scheduling_request_id').references(() => schedulingRequests.id, { onDelete: 'set null' }),
  assignedTechnicianId: uuid('assigned_technician_id').references(() => technicians.id, { onDelete: 'set null' }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  status: workOrderStatusEnum('status').notNull().default('draft'),
  scheduledStart: timestamp('scheduled_start', { withTimezone: true }),
  scheduledEnd: timestamp('scheduled_end', { withTimezone: true }),
  region: varchar('region', { length: 100 }),
  requiredSkillTag: varchar('required_skill_tag', { length: 100 }),
  dispatchNotes: text('dispatch_notes'),
  dispatchPacket: text('dispatch_packet'), // stored as JSON string
  fortyEightHourNoticeRequired: boolean('forty_eight_hour_notice_required').default(false).notNull(),
  fortyEightHourDeadline: timestamp('forty_eight_hour_deadline', { withTimezone: true }),
  fortyEightHourSentAt: timestamp('forty_eight_hour_sent_at', { withTimezone: true }),
  fortyEightHourSentBy: uuid('forty_eight_hour_sent_by').references(() => users.id, { onDelete: 'set null' }),
  fortyEightHourStatus: fortyEightHourStatusEnum('forty_eight_hour_status').default('not_required').notNull(),
  completionNotes: text('completion_notes'),
  completionPhotos: text('completion_photos').array().default([]),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  jobIdIdx: index('work_orders_job_id_idx').on(t.jobId),
  statusIdx: index('work_orders_status_idx').on(t.status),
  assignedTechnicianIdx: index('work_orders_assigned_technician_idx').on(t.assignedTechnicianId),
  fortyEightStatusIdx: index('work_orders_48h_status_idx').on(t.fortyEightHourStatus),
  scheduledStartIdx: index('work_orders_scheduled_start_idx').on(t.scheduledStart),
}));

// ─── Compliance Notices ───────────────────────────────────────────────────────
export const complianceNotices = pgTable('compliance_notices', {
  id: uuid('id').primaryKey().defaultRandom(),
  workOrderId: uuid('work_order_id').notNull().references(() => workOrders.id, { onDelete: 'cascade' }),
  jobId: uuid('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  draftedBy: uuid('drafted_by').references(() => users.id, { onDelete: 'set null' }),
  status: complianceNoticeStatusEnum('status').notNull().default('draft'),
  recipientName: varchar('recipient_name', { length: 255 }),
  recipientEmail: varchar('recipient_email', { length: 255 }),
  recipientPhone: varchar('recipient_phone', { length: 50 }),
  noticeBody: text('notice_body').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  workOrderIdIdx: index('compliance_notices_work_order_id_idx').on(t.workOrderId),
  jobIdIdx: index('compliance_notices_job_id_idx').on(t.jobId),
}));

export type SchedulingRequest = typeof schedulingRequests.$inferSelect;
export type NewSchedulingRequest = typeof schedulingRequests.$inferInsert;
export type Technician = typeof technicians.$inferSelect;
export type NewTechnician = typeof technicians.$inferInsert;
export type WorkOrder = typeof workOrders.$inferSelect;
export type NewWorkOrder = typeof workOrders.$inferInsert;
export type ComplianceNotice = typeof complianceNotices.$inferSelect;
export type NewComplianceNotice = typeof complianceNotices.$inferInsert;
