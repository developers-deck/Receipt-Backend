import { pgTable, uuid, varchar, timestamp, decimal, jsonb, boolean, text, serial } from 'drizzle-orm/pg-core';

export const receiptsTable = pgTable('receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  receiptNumber: varchar('receipt_number', { length: 255 }).notNull().unique(),
  issueDate: timestamp('issue_date', { withTimezone: true }).notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  items: jsonb('items'),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  isVerified: boolean('is_verified').default(false).notNull(),
  verificationDetails: text('verification_details'),
  verifiedByTRAAt: timestamp('verified_by_tra_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// You can define other tables here as well
// export type InsertReceipt = typeof receiptsTable.$inferInsert;
// export type SelectReceipt = typeof receiptsTable.$inferSelect;