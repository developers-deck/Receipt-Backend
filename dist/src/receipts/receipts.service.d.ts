import { GetReceiptDto } from './dto/get-receipt.dto';
import { DbType } from '../db/db.provider';
import { ScraperService } from './scraper.service';
import { PdfQueueService } from './pdf-queue.service';
import { FileUploadService } from '../file-upload/file-upload.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { PlaywrightService } from '../playwright/playwright.service';
export declare class ReceiptsService {
    private db;
    private readonly scraper;
    private readonly pdfQueue;
    private readonly fileUploadService;
    private readonly pdfGenerator;
    private readonly playwrightService;
    private readonly logger;
    constructor(db: DbType, scraper: ScraperService, pdfQueue: PdfQueueService, fileUploadService: FileUploadService, pdfGenerator: PdfGeneratorService, playwrightService: PlaywrightService);
    createReceipt(getReceiptDto: GetReceiptDto, userId: string): Promise<{
        status: string;
        receiptId: any;
    }>;
    findAll(user: {
        id: string;
    } | null, options: {
        page: number;
        limit: number;
        companyName?: string;
        customerName?: string;
        tin?: string;
    }): Promise<{
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
    getReceiptById(id: string, requestingUser: {
        sub: string;
        role: string;
    }): Promise<{
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
    deleteReceipt(id: string, requestingUser: {
        sub: string;
        role: string;
    }): Promise<void>;
    exportReceiptPdf(id: string, requestingUser: {
        sub: string;
        role: string;
    }): Promise<Buffer>;
    getUserStats(user: {
        id: string;
    }): Promise<{
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
    retryPdfGeneration(receiptId: number, userId: string): Promise<{
        status: string;
        message: string;
        receiptId?: undefined;
    } | {
        status: string;
        receiptId: number;
        message?: undefined;
    }>;
    retryAllFailedPdfGenerations(userId: string): Promise<{
        status: string;
        message: string;
        count: number;
    }>;
}
