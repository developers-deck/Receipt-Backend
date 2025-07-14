import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
export declare const DB_PROVIDER = "DB_PROVIDER";
export type DbType = NodePgDatabase<typeof schema>;
export declare const dbProvider: {
    provide: string;
    inject: (typeof ConfigService)[];
    useFactory: (configService: ConfigService) => Promise<NodePgDatabase<typeof schema>>;
};
export declare class DbService {
}
