import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import * as schema from './schema';
export declare const DB_PROVIDER = "DB_PROVIDER";
export declare const dbProvider: {
    provide: string;
    useFactory: (configService: ConfigService) => import("drizzle-orm/node-postgres").NodePgDatabase<typeof schema> & {
        $client: Pool;
    };
    inject: (typeof ConfigService)[];
};
export declare class DbService {
}
