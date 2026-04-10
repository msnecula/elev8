import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { urgencyEnum, noticeStatusEnum, noticeIntakeMethodEnum } from './enums';
import { accounts } from './accounts';
import { properties } from './properties';
import { users } from './users';

export type ParsedNoticeData = {
  documentType: string;
  clientCompany: string;
  propertyName: string;
  propertyAddress: string;
  buildingType: string;
  inspectionDate: string | null;
  stateDeadline: string | null;
  requiredWorkSummary: string;
  detailedScope: string;
  violationItems: string[];
  workType: string;
  requiredSkillTag: string;
  estimatedDurationHours: number | null;
  estimatedLaborHours: number | null;
  estimatedMaterials: number | null;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  fortyEightHourRequired: boolean;
  complianceCoordinationRequired: boolean;
  missingInformation: string[];
  parseConfidence: number;
};

export const notices = pgTable('notices', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'set null' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  submittedBy: uuid('submitted_by').references(() => users.id, { onDelete: 'set null' }),
  intakeMethod: noticeIntakeMethodEnum('intake_method').notNull().default('portal_upload'),
  status: noticeStatusEnum('status').notNull().default('received'),
  filePath: text('file_path'),
  fileName: varchar('file_name', { length: 500 }),
  fileSize: integer('file_size'),
  mimeType: varchar('mime_type', { length: 100 }),
  rawText: text('raw_text'),
  parsedData: jsonb('parsed_data').$type<ParsedNoticeData>(),
  assignedReviewerId: uuid('assigned_reviewer_id').references(() => users.id, { onDelete: 'set null' }),
  urgency: urgencyEnum('urgency').default('medium'),
  stateDeadline: timestamp('state_deadline', { withTimezone: true }),
  parseError: text('parse_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  accountIdIdx: index('notices_account_id_idx').on(t.accountId),
  propertyIdIdx: index('notices_property_id_idx').on(t.propertyId),
  statusIdx: index('notices_status_idx').on(t.status),
  urgencyIdx: index('notices_urgency_idx').on(t.urgency),
  assignedReviewerIdx: index('notices_assigned_reviewer_idx').on(t.assignedReviewerId),
  createdAtIdx: index('notices_created_at_idx').on(t.createdAt),
}));

export type Notice = typeof notices.$inferSelect;
export type NewNotice = typeof notices.$inferInsert;
