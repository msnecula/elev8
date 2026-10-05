import { pgTable, uuid, varchar, text, integer, boolean, timestamp, numeric, jsonb, index } from 'drizzle-orm/pg-core';
import { proposalStatusEnum } from './enums';
import { jobs } from './jobs';
import { users } from './users';

export type ProposalLineItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
};

export const proposalTemplates = pgTable('proposal_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  workType: varchar('work_type', { length: 100 }),
  bodyTemplate: text('body_template').notNull(),
  defaultLineItems: jsonb('default_line_items').$type<ProposalLineItem[]>().default([]),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const proposals = pgTable('proposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  templateId: uuid('template_id').references(() => proposalTemplates.id, { onDelete: 'set null' }),
  draftedBy: uuid('drafted_by').references(() => users.id, { onDelete: 'set null' }),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  status: proposalStatusEnum('status').notNull().default('draft'),
  title: varchar('title', { length: 500 }).notNull(),
  body: text('body').notNull(),
  lineItems: jsonb('line_items').$type<ProposalLineItem[]>().default([]),
  totalAmount: numeric('total_amount', { precision: 10, scale: 2 }).default('0'),
  version: integer('version').default(1).notNull(),
  revisionNotes: text('revision_notes'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  jobIdIdx: index('proposals_job_id_idx').on(t.jobId),
  statusIdx: index('proposals_status_idx').on(t.status),
}));

export type ProposalTemplate = typeof proposalTemplates.$inferSelect;
export type NewProposalTemplate = typeof proposalTemplates.$inferInsert;
export type Proposal = typeof proposals.$inferSelect;
export type NewProposal = typeof proposals.$inferInsert;
