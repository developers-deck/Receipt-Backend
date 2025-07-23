import { ReceiptsService } from './receipts.service';
import { GetReceiptDto } from './dto/get-receipt.dto';
import { Response as ExpressResponse } from 'express';
export declare class ReceiptsController {
    private readonly receiptsService;
    private readonly logger;
    constructor(receiptsService: ReceiptsService);
    createReceipt(getReceiptDto: GetReceiptDto, req: any): Promise<{
        status: string;
        receiptId: any;
    }>;
    getAllReceipts(page?: number, limit?: number, companyName?: string, customerName?: string, tin?: string): Promise<{
        data: {
            verificationCode: string;
            receiptTime: string | null;
            id: number;
            createdAt: Date | null;
            userId: string;
            companyName: string | null;
            poBox: string | null;
            mobile: string | null;
            tin: string | null;
            vrn: string | null;
            serialNo: string | null;
            uin: string | null;
            taxOffice: string | null;
            customerName: string | null;
            customerIdType: string | null;
            customerId: string | null;
            customerMobile: string | null;
            receiptNo: string | null;
            zNumber: string | null;
            receiptDate: string | null;
            totalExclTax: string | null;
            totalTax: string | null;
            totalInclTax: string | null;
            verificationCodeUrl: string | null;
            receiptDataHash: string;
            pdfUrl: string | null;
            pdfStatus: string | null;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            lastPage: number;
        };
    }>;
    findMyReceipts(req: any, page?: number, limit?: number, companyName?: string, customerName?: string, tin?: string): Promise<{
        data: {
            verificationCode: string;
            receiptTime: string | null;
            id: number;
            createdAt: Date | null;
            userId: string;
            companyName: string | null;
            poBox: string | null;
            mobile: string | null;
            tin: string | null;
            vrn: string | null;
            serialNo: string | null;
            uin: string | null;
            taxOffice: string | null;
            customerName: string | null;
            customerIdType: string | null;
            customerId: string | null;
            customerMobile: string | null;
            receiptNo: string | null;
            zNumber: string | null;
            receiptDate: string | null;
            totalExclTax: string | null;
            totalTax: string | null;
            totalInclTax: string | null;
            verificationCodeUrl: string | null;
            receiptDataHash: string;
            pdfUrl: string | null;
            pdfStatus: string | null;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            lastPage: number;
        };
    }>;
    getReceiptById(id: string, req: any): Promise<{
        items: {
            id: number;
            createdAt: Date | null;
            receiptId: number;
            description: string | null;
            quantity: string | null;
            amount: string | null;
        }[];
        verificationCode: string;
        receiptTime: string | null;
        id: number;
        createdAt: Date | null;
        userId: string;
        companyName: string | null;
        poBox: string | null;
        mobile: string | null;
        tin: string | null;
        vrn: string | null;
        serialNo: string | null;
        uin: string | null;
        taxOffice: string | null;
        customerName: string | null;
        customerIdType: string | null;
        customerId: string | null;
        customerMobile: string | null;
        receiptNo: string | null;
        zNumber: string | null;
        receiptDate: string | null;
        totalExclTax: string | null;
        totalTax: string | null;
        totalInclTax: string | null;
        verificationCodeUrl: string | null;
        receiptDataHash: string;
        pdfUrl: string | null;
        pdfStatus: string | null;
    }>;
    deleteReceipt(id: string, req: any): Promise<void>;
    downloadPdf(id: string, req: any, res: ExpressResponse): Promise<void>;
    getMyStats(req: any): Promise<{
        sum: {
            totalTax: number;
            totalInclTax: number;
            totalExclTax: number;
        };
        receipts: {
            id: number;
            companyName: string | null;
            totalTax: number;
            totalInclTax: number;
            totalExclTax: number;
            receiptDate: string | null;
            receiptNo: string | null;
            customerName: string | null;
        }[];
        companyTax: Record<string, number>;
    }>;
    retryPdfGeneration(id: string, req: any): Promise<{
        status: string;
        message: string;
        receiptId?: undefined;
    } | {
        status: string;
        receiptId: number;
        message?: undefined;
    }>;
    retryAllFailedPdfGenerations(req: any): Promise<{
        status: string;
        message: string;
        count: number;
    }>;
}
