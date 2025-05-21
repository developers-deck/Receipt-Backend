import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const receipts = pgTable('receipts', {
  id: serial('id').primaryKey(),
  verificationCode: text('verification_code').notNull().unique(),
  receiptTime: text('receipt_time').notNull(),
  receiptData: text('receipt_data'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;