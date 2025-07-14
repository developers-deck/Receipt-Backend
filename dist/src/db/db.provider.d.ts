import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
export declare const DB_PROVIDER = "DB_PROVIDER";
export type DbType = NodePgDatabase<typeof schema>;
export declare const dbProvider: {
    provide: string;
    useFactory: (configService: ConfigService) => Promise<NodePgDatabase<typeof schema>>;
    inject: (typeof ConfigService)[];
};
export declare class DbService {
}
