import { ConfigService } from '@nestjs/config';
import * as schema from './schema';
export declare const DB_PROVIDER = "DB_PROVIDER";
export declare const dbProvider: {
    provide: string;
    useFactory: (configService: ConfigService) => import("drizzle-orm/node-postgres").NodePgDatabase<typeof schema>;
    inject: (typeof ConfigService)[];
};
export declare class DbService {
}
