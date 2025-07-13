import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
export type DbType = ReturnType<typeof drizzle<typeof schema>>;
export { schema };
export { drizzle } from 'drizzle-orm/node-postgres';
