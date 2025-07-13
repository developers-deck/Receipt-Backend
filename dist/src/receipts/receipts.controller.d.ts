import { ReceiptsService } from './receipts.service';
export declare class ReceiptsController {
    private readonly receiptsService;
    constructor(receiptsService: ReceiptsService);
    getAllReceipts(): unknown;
    getReceipt(verificationCode: string, receiptTime: string): unknown;
    getReceiptById(id: string): unknown;
    getReceiptsByCompanyName(companyName: string): unknown;
}
