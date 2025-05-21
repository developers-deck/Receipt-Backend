import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type DbType = ReturnType<typeof drizzle<typeof schema>>;

// Export the schema
export { schema };