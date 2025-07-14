import { Inject, Injectable } from '@nestjs/common';
import { DB_PROVIDER, DbType } from '../db/db.provider';
import { users, receipts } from '../db/schema';
import { sql, count, sum, gte } from 'drizzle-orm';
import { subDays } from 'date-fns';

@Injectable()
export class AdminService {
  constructor(@Inject(DB_PROVIDER) private readonly db: DbType) {}

  async getDashboardStats() {
    const [userCountResult] = await this.db.select({ value: count() }).from(users);
    const [receiptCountResult] = await this.db.select({ value: count() }).from(receipts);
    // Remove commas from totalTax before casting to numeric
    const [totalTaxResult] = await this.db.select({ value: sum(sql<number>`CAST(REPLACE(${receipts.totalTax}, ',', '') AS numeric)`) }).from(receipts);

    const thirtyDaysAgo = subDays(new Date(), 30);
    const [recentReceiptsResult] = await this.db
      .select({ value: count() })
      .from(receipts)
      .where(gte(receipts.createdAt, thirtyDaysAgo));

    return {
      totalUsers: userCountResult.value,
      totalReceipts: receiptCountResult.value,
      totalTax: totalTaxResult.value || 0,
      receiptsLast30Days: recentReceiptsResult.value,
    };
  }
}
