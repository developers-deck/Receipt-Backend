import { ReceiptsService } from './receipts.service';
export declare class ReceiptsController {
    private readonly receiptsService;
    constructor(receiptsService: ReceiptsService);
    getReceipt(verificationCode: string, receiptTime: string): Promise<{
        verificationCode: string;
        receiptTime: string;
        id?: number | undefined;
        receiptData?: string | null | undefined;
        createdAt?: Date | null | undefined;
    } | {
        error: string;
    }>;
}
