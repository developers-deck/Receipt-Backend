import { pgTable, serial, text, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['admin', 'user']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  role: userRole('role').default('user'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const receipts = pgTable('receipts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
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
  pdfUrl: text('pdf_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const purchasedItems = pgTable('purchased_items', {
  id: serial('id').primaryKey(),
  receiptId: serial('receipt_id').references(() => receipts.id),
  description: text('description'),
  quantity: text('quantity'),
  amount: text('amount'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;
export type PurchasedItem = typeof purchasedItems.$inferSelect;
export type NewPurchasedItem = typeof purchasedItems.$inferInsert;