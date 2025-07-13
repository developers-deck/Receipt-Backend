"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.purchasedItems = exports.receipts = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    username: (0, pg_core_1.varchar)('username', { length: 255 }).notNull().unique(),
    passwordHash: (0, pg_core_1.text)('password_hash').notNull(),
    role: (0, pg_core_1.varchar)('role', { enum: ['admin', 'user'] }).default('user').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.receipts = (0, pg_core_1.pgTable)('receipts', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    companyName: (0, pg_core_1.text)('company_name'),
    poBox: (0, pg_core_1.text)('po_box'),
    mobile: (0, pg_core_1.text)('mobile'),
    tin: (0, pg_core_1.text)('tin'),
    vrn: (0, pg_core_1.text)('vrn'),
    serialNo: (0, pg_core_1.text)('serial_no'),
    uin: (0, pg_core_1.text)('uin'),
    taxOffice: (0, pg_core_1.text)('tax_office'),
    customerName: (0, pg_core_1.text)('customer_name'),
    customerIdType: (0, pg_core_1.text)('customer_id_type'),
    customerId: (0, pg_core_1.text)('customer_id'),
    customerMobile: (0, pg_core_1.text)('customer_mobile'),
    receiptNo: (0, pg_core_1.text)('receipt_no'),
    zNumber: (0, pg_core_1.text)('z_number'),
    receiptDate: (0, pg_core_1.text)('receipt_date'),
    receiptTime: (0, pg_core_1.text)('receipt_time'),
    totalExclTax: (0, pg_core_1.text)('total_excl_tax'),
    totalTax: (0, pg_core_1.text)('total_tax'),
    totalInclTax: (0, pg_core_1.text)('total_incl_tax'),
    verificationCode: (0, pg_core_1.text)('verification_code').notNull().unique(),
    verificationCodeUrl: (0, pg_core_1.text)('verification_code_url'),
    pdfUrl: (0, pg_core_1.text)('pdf_url'),
    pdfStatus: (0, pg_core_1.text)('pdf_status').default('pending'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.purchasedItems = (0, pg_core_1.pgTable)('purchased_items', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    receiptId: (0, pg_core_1.integer)('receipt_id').references(() => exports.receipts.id, { onDelete: 'cascade' }).notNull(),
    description: (0, pg_core_1.text)('description'),
    quantity: (0, pg_core_1.text)('quantity'),
    amount: (0, pg_core_1.text)('amount'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
//# sourceMappingURL=schema.js.map