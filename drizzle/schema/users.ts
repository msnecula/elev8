import { pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { userRoleEnum } from './enums';
import { accounts } from './accounts';

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('client'),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  phone: varchar('phone', { length: 50 }),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  accountIdIdx: index('users_account_id_idx').on(t.accountId),
  roleIdx: index('users_role_idx').on(t.role),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
