import { Module, Provider } from '@nestjs/common';
import { DB_PROVIDER, DbService } from './db.provider';
import { drizzle } from 'drizzle-orm/postgres-js';
const postgres = require('postgres');

const dbProvider: Provider = {
  provide: DB_PROVIDER,
  useFactory: async () => {
    const client = postgres(process.env.DATABASE_URL);
    return drizzle(client);
  },
};

@Module({
  providers: [dbProvider, DbService],
  exports: [DB_PROVIDER, DbService],
})
export class DbModule {}