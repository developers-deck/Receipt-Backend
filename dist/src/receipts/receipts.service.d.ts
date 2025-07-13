import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';
import { HttpService } from '@nestjs/axios';
export declare class CreateReceiptDto {
    verificationSecret: string;
}
export declare class ReceiptsService {
    private db;
    private readonly httpService;
    private readonly logger;
    private readonly traBaseUrl;
    private httpServiceWithCookies;
    constructor(db: NodePgDatabase<typeof schema>, httpService: HttpService);
    private cleanText;
    private parseAmount;
    private fetchVerificationData;
    private fetchReceiptData;
    createAndVerifyReceipt(createReceiptDto: CreateReceiptDto): Promise<typeof schema.receiptsTable['$inferSelect']>;
    findAll(): Promise<typeof schema.receiptsTable['$inferSelect'][]>;
    findOne(id: string): Promise<typeof schema.receiptsTable['$inferSelect'] | undefined>;
    findOneByReceiptNumber(receiptNumber: string): Promise<typeof schema.receiptsTable['$inferSelect'] | undefined>;
    private extractTextAfterB;
    private generateReceiptPdf;
}
