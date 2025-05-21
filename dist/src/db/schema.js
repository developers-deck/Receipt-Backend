"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.receipts = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.receipts = (0, pg_core_1.pgTable)('receipts', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    verificationCode: (0, pg_core_1.text)('verification_code').notNull().unique(),
    receiptTime: (0, pg_core_1.text)('receipt_time').notNull(),
    receiptData: (0, pg_core_1.text)('receipt_data'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
//# sourceMappingURL=schema.js.map