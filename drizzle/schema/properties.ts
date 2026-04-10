import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { buildingTypeEnum } from './enums';
import { accounts } from './accounts';

export const properties = pgTable('properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address').notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 50 }).notNull().default('CA'),
  zip: varchar('zip', { length: 20 }),
  buildingType: buildingTypeEnum('building_type').notNull(),
  elevatorCount: integer('elevator_count').default(1).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  accountIdIdx: index('properties_account_id_idx').on(t.accountId),
  buildingTypeIdx: index('properties_building_type_idx').on(t.buildingType),
}));

export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
