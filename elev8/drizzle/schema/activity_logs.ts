import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { entityTypeEnum, activityEventTypeEnum, notificationTypeEnum, notificationStatusEnum } from './enums';
import { users } from './users';
import { jobs } from './jobs';

// ─── File Attachments ─────────────────────────────────────────────────────────
export const fileAttachments = pgTable('file_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: entityTypeEnum('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  fileName: varchar('file_name', { length: 500 }).notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size'),
  mimeType: varchar('mime_type', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  entityIdx: index('file_attachments_entity_idx').on(t.entityType, t.entityId),
  uploadedByIdx: index('file_attachments_uploaded_by_idx').on(t.uploadedBy),
}));

// ─── Activity Logs ────────────────────────────────────────────────────────────
export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: entityTypeEnum('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  eventType: activityEventTypeEnum('event_type').notNull(),
  description: text('description').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  entityIdx: index('activity_logs_entity_idx').on(t.entityType, t.entityId),
  actorIdIdx: index('activity_logs_actor_id_idx').on(t.actorId),
  eventTypeIdx: index('activity_logs_event_type_idx').on(t.eventType),
  createdAtIdx: index('activity_logs_created_at_idx').on(t.createdAt),
}));

// ─── Notifications ────────────────────────────────────────────────────────────
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
  type: notificationTypeEnum('type').notNull(),
  channel: varchar('channel', { length: 255 }),
  subject: varchar('subject', { length: 500 }),
  body: text('body').notNull(),
  status: notificationStatusEnum('status').notNull().default('pending'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index('notifications_user_id_idx').on(t.userId),
  jobIdIdx: index('notifications_job_id_idx').on(t.jobId),
  statusIdx: index('notifications_status_idx').on(t.status),
}));

export type FileAttachment = typeof fileAttachments.$inferSelect;
export type NewFileAttachment = typeof fileAttachments.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
