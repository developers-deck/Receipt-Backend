import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NewReceipt } from '../db/schema';
import { DbType } from '../db';
export declare class ReceiptsService implements OnModuleInit, OnModuleDestroy {
    private db;
    private browser;
    private page;
    constructor(db: DbType);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    getReceipt(verificationCode: string, receiptTime: string): Promise<NewReceipt | null>;
}
