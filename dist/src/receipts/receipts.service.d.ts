import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NewReceipt } from '../db/schema';
export declare class ReceiptsService implements OnModuleInit, OnModuleDestroy {
    private browser;
    private page;
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    getReceipt(verificationCode: string, receiptTime: string): Promise<NewReceipt | null>;
}
