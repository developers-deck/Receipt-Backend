export declare const receipts: any;
export declare const purchasedItems: any;
export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;
export type PurchasedItem = typeof purchasedItems.$inferSelect;
export type NewPurchasedItem = typeof purchasedItems.$inferInsert;
