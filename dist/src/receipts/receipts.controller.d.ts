import { ReceiptsService } from './receipts.service';
export declare class ReceiptsController {
    private readonly receiptsService;
    constructor(receiptsService: ReceiptsService);
    getReceipt(verificationCode: string, receiptTime: string): Promise<{
        verificationCode: string;
        id?: number | undefined;
        companyName?: string | null | undefined;
        poBox?: string | null | undefined;
        mobile?: string | null | undefined;
        tin?: string | null | undefined;
        vrn?: string | null | undefined;
        serialNo?: string | null | undefined;
        uin?: string | null | undefined;
        taxOffice?: string | null | undefined;
        customerName?: string | null | undefined;
        customerIdType?: string | null | undefined;
        customerId?: string | null | undefined;
        customerMobile?: string | null | undefined;
        receiptNo?: string | null | undefined;
        zNumber?: string | null | undefined;
        receiptDate?: string | null | undefined;
        receiptTime?: string | null | undefined;
        totalExclTax?: string | null | undefined;
        totalTax?: string | null | undefined;
        totalInclTax?: string | null | undefined;
        verificationCodeUrl?: string | null | undefined;
        createdAt?: Date | null | undefined;
    } | {
        error: string;
    }>;
}
