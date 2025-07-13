import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type DbType = ReturnType<typeof drizzle<typeof schema>>;

// Export the schema
export { schema };

// Re-export the drizzle function for easier imports
export { drizzle } from 'drizzle-orm/node-postgres';