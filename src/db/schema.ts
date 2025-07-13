import { pgTable, serial, text, timestamp, varchar, integer } from 'drizzle-orm/pg-core';

// Users Table: Stores user credentials and roles
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { enum: ['admin', 'user'] }).default('user').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Receipts Table: Stores all scraped receipt data
export const receipts = pgTable('receipts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  companyName: text('company_name'),
  poBox: text('po_box'),
  mobile: text('mobile'),
  tin: text('tin'),
  vrn: text('vrn'),
  serialNo: text('serial_no'),
  uin: text('uin'),
  taxOffice: text('tax_office'),
  customerName: text('customer_name'),
  customerIdType: text('customer_id_type'),
  customerId: text('customer_id'),
  customerMobile: text('customer_mobile'),
  receiptNo: text('receipt_no'),
  zNumber: text('z_number'),
  receiptDate: text('receipt_date'),
  receiptTime: text('receipt_time'),
  totalExclTax: text('total_excl_tax'),
  totalTax: text('total_tax'),
  totalInclTax: text('total_incl_tax'),
  verificationCode: text('verification_code').notNull().unique(),
  verificationCodeUrl: text('verification_code_url'),
  pdfUrl: text('pdf_url'), // Link to the PDF stored in Backblaze B2
  createdAt: timestamp('created_at').defaultNow(),
});

// Purchased Items Table: Stores individual items from each receipt
export const purchasedItems = pgTable('purchased_items', {
  id: serial('id').primaryKey(),
  receiptId: integer('receipt_id').references(() => receipts.id, { onDelete: 'cascade' }).notNull(),
  description: text('description'),
  quantity: text('quantity'),
  amount: text('amount'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define TypeScript types for easy use in services
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;
export type PurchasedItem = typeof purchasedItems.$inferSelect;
export type NewPurchasedItem = typeof purchasedItems.$inferInsert;