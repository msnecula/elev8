import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { documentTypeEnum } from './enums';
import { accounts } from './accounts';
import { properties } from './properties';
import { notices } from './notices';
import { jobs } from './jobs';
import { users } from './users';

/**
 * documents — central vault for every file that enters or exits the system.
 *
 * Every Cal/OSHA notice PDF, generated compliance form (EU-632, EU-787, advance notice),
 * and any other document produced by the system is stored here with its Supabase
 * Storage path. This provides a legal paper trail: Precision Lift Co. can pull up
 * any property at any time and see every document associated with it, with download access.
 *
 * storageBucket: 'notices' for original notice PDFs, 'documents' for generated forms.
 */
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'set null' }),
  noticeId: uuid('notice_id').references(() => notices.id, { onDelete: 'set null' }),
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
  documentType: documentTypeEnum('document_type').notNull(),
  storageBucket: text('storage_bucket').notNull(),
  storagePath: text('storage_path').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull().default('application/pdf'),
  fileSizeBytes: integer('file_size_bytes'),
  generatedBy: uuid('generated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  accountIdIdx: index('documents_account_id_idx').on(t.accountId),
  propertyIdIdx: index('documents_property_id_idx').on(t.propertyId),
  noticeIdIdx: index('documents_notice_id_idx').on(t.noticeId),
  jobIdIdx: index('documents_job_id_idx').on(t.jobId),
  createdAtIdx: index('documents_created_at_idx').on(t.createdAt),
}));

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentType = typeof documentTypeEnum.enumValues[number];
