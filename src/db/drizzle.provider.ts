import { FactoryProvider, Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { drizzle, NodePgClient } from 'drizzle-orm/node-postgres';
import { Pool, Client } from 'pg';
import * as schema from './schema'; // Import all exports from schema.ts
import * as dotenv from 'dotenv';

// Remove the dotenv.config() call here
// dotenv.config();

export const DRIZZLE_ORM_TOKEN = Symbol('DRIZZLE_ORM');

// Option 1: Using a Pool (recommended for most applications)
export const DrizzleAsyncProvider: FactoryProvider = {
  provide: DRIZZLE_ORM_TOKEN,
  useFactory: async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set in environment variables');
    }
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // Test the connection
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
    } catch (error) {
      throw new Error(`Failed to connect to database: ${error.message}`);
    }
    
    return drizzle(pool, { schema });
  },
  inject: [],
};

// If you want to make the Drizzle instance available globally
// you can create a DrizzleModule
@Global()
@Module({
  providers: [DrizzleAsyncProvider],
  exports: [DRIZZLE_ORM_TOKEN], // Export the token so it can be injected
})
export class DrizzleModule {}

// // Option 2: Using a single Client (less common for web servers)
// // If you choose this, make sure to manage the client connection lifecycle
// @Injectable()
// export class DrizzleService implements OnModuleInit, OnModuleDestroy {
//   private _db: NodePgClient;
//   public client: ReturnType<typeof drizzle>;

//   async onModuleInit() {
//     if (!process.env.DATABASE_URL) {
//       throw new Error('DATABASE_URL is not set in environment variables');
//     }
//     this._db = new Client({ connectionString: process.env.DATABASE_URL });
//     await this._db.connect();
//     this.client = drizzle(this._db, { schema });
//   }

//   async onModuleDestroy() {
//     if (this._db) {
//       await this._db.end();
//     }
//   }
// }

// // If using DrizzleService approach, the provider would be:
// // export const DrizzleServiceProvider = {
// //   provide: DRIZZLE_ORM_TOKEN,
// //   useExisting: DrizzleService,
// // };