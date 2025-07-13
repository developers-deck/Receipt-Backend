import { ConfigService } from '@nestjs/config';
export declare const DB_PROVIDER = "DB_PROVIDER";
export declare const dbProvider: {
    provide: string;
    useFactory: (configService: ConfigService) => unknown;
    inject: {};
};
export declare class DbService {
}
