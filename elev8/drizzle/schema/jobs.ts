import { pgTable, uuid, varchar, text, boolean, timestamp, date, numeric, jsonb, index } from 'drizzle-orm/pg-core';
import { urgencyEnum, jobStageEnum, buildingTypeEnum } from './enums';
import { accounts } from './accounts';
import { properties } from './properties';
import { notices } from './notices';
import { users } from './users';

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  noticeId: uuid('notice_id').references(() => notices.id, { onDelete: 'set null' }),
  propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'set null' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  assignedReviewerId: uuid('assigned_reviewer_id').references(() => users.id, { onDelete: 'set null' }),
  stage: jobStageEnum('stage').notNull().default('notice_received'),
  urgency: urgencyEnum('urgency').notNull().default('medium'),
  title: varchar('title', { length: 500 }),
  nextActionDate: date('next_action_date'),
  riskFlags: jsonb('risk_flags').$type<string[]>().default([]),
  buildingType: buildingTypeEnum('building_type'),
  requiredSkillTag: varchar('required_skill_tag', { length: 100 }),
  estimatedDurationHours: numeric('estimated_duration_hours', { precision: 6, scale: 2 }),
  estimatedLaborHours: numeric('estimated_labor_hours', { precision: 6, scale: 2 }),
  estimatedMaterialsCost: numeric('estimated_materials_cost', { precision: 10, scale: 2 }),
  complianceCoordinationRequired: boolean('compliance_coordination_required').default(false),
  fortyEightHourRequired: boolean('forty_eight_hour_required').default(false),
  internalNotes: text('internal_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  accountIdIdx: index('jobs_account_id_idx').on(t.accountId),
  propertyIdIdx: index('jobs_property_id_idx').on(t.propertyId),
  noticeIdIdx: index('jobs_notice_id_idx').on(t.noticeId),
  stageIdx: index('jobs_stage_idx').on(t.stage),
  urgencyIdx: index('jobs_urgency_idx').on(t.urgency),
  assignedReviewerIdx: index('jobs_assigned_reviewer_idx').on(t.assignedReviewerId),
  nextActionDateIdx: index('jobs_next_action_date_idx').on(t.nextActionDate),
}));

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
