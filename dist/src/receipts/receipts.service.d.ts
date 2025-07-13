import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { NewReceipt } from '../db/schema';
import { DbType } from '../db';
import { ConfigService } from '@nestjs/config';
export declare class ReceiptsService implements OnModuleInit, OnModuleDestroy {
    private db;
    private configService;
    private browser;
    private page;
    constructor(db: DbType, configService: ConfigService);
    onModuleInit(): any;
    private initializeBrowser;
    onModuleDestroy(): any;
    getAllReceipts(): unknown;
    getReceipt(verificationCode: string, receiptTime: string): Promise<NewReceipt>;
    getReceiptById(id: number): unknown;
    getReceiptsByCompanyName(companyName: string): unknown;
}
