import { Module, Provider } from '@nestjs/common';
import { DB_PROVIDER, DbService } from './db.provider';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';

const dbProvider: Provider = {
  provide: DB_PROVIDER,
  useFactory: async () => {
    const client = postgres.default(process.env.DATABASE_URL || 'YOUR_DATABASE_URL'); // Replace with your actual connection string or environment variable
    return drizzle(client);
  },
};

@Module({
  providers: [dbProvider, DbService],
  exports: [DB_PROVIDER, DbService],
})
export class DbModule {}