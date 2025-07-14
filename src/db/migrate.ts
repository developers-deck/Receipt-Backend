import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

console.log('Migration script started.');

const runMigrations = async () => {
  try {
    console.log('Loading environment variables...');
    dotenv.config();
    console.log('Environment variables loaded.');

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set.');
    }
    console.log('Database URL found.');

    console.log('Creating database pool...');
    const pool = new Pool({ connectionString });
    console.log('Database pool created.');

    console.log('Initializing Drizzle ORM...');
    const db = drizzle(pool);
    console.log('Drizzle ORM initialized.');

    console.log('Running database migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed successfully.');

    console.log('Closing database pool...');
    await pool.end();
    console.log('Database pool closed.');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1); // Exit with error code if something fails
  }
};

runMigrations().then(() => {
  console.log('Migration script finished.');
  process.exit(0); // Exit with success code
});

