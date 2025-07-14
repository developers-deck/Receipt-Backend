"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptsService = void 0;
const common_1 = require("@nestjs/common");
const drizzle_orm_1 = require("drizzle-orm");
const schema_1 = require("../db/schema");
const db_provider_1 = require("../db/db.provider");
const scraper_service_1 = require("./scraper.service");
const pdf_queue_service_1 = require("./pdf-queue.service");
const crypto = require("crypto");
const file_upload_service_1 = require("../file-upload/file-upload.service");
const pdf_generator_service_1 = require("./pdf-generator.service");
const playwright_service_1 = require("../playwright/playwright.service");
let ReceiptsService = class ReceiptsService {
    db;
    scraper;
    pdfQueue;
    fileUploadService;
    pdfGenerator;
    playwrightService;
    constructor(db, scraper, pdfQueue, fileUploadService, pdfGenerator, playwrightService) {
        this.db = db;
        this.scraper = scraper;
        this.pdfQueue = pdfQueue;
        this.fileUploadService = fileUploadService;
        this.pdfGenerator = pdfGenerator;
        this.playwrightService = playwrightService;
    }
    async createReceipt(getReceiptDto, userId) {
        const browser = await this.playwrightService.getBrowser();
        const page = await browser.newPage();
        let scraped;
        try {
            const traVerifyUrl = process.env.TRA_VERIFY_URL;
            if (!traVerifyUrl) {
                throw new Error('TRA_VERIFY_URL environment variable is not set.');
            }
            scraped = await this.scraper.scrapeReceipt(page, getReceiptDto.verificationCode, getReceiptDto.receiptTime, traVerifyUrl);
        }
        catch (error) {
            throw new common_1.ServiceUnavailableException(`Failed to scrape receipt data: ${error.message}`);
        }
        finally {
            await page.close();
        }
        const receiptDataString = JSON.stringify({
            details: scraped.details,
            items: scraped.items,
            totals: scraped.totalAmounts,
        });
        const receiptDataHash = crypto.createHash('sha256').update(receiptDataString).digest('hex');
        const newReceipt = {
            userId: userId,
            receiptDataHash,
            companyName: scraped.companyName,
            poBox: scraped.poBox,
            mobile: scraped.mobile,
            tin: scraped.details['TIN:'] || '',
            vrn: scraped.details['VRN:'] || '',
            serialNo: scraped.details['Serial No:'] || '',
            uin: scraped.details['UIN:'] || '',
            taxOffice: scraped.details['Tax Office:'] || '',
            customerName: scraped.details['Customer Name:'] || '',
            customerIdType: scraped.details['Customer ID Type:'] || '',
            customerId: scraped.details['Customer ID:'] || '',
            customerMobile: scraped.details['Customer Mobile:'] || '',
            receiptNo: scraped.details['Receipt No:'] || '',
            zNumber: scraped.details['Z-Number:'] || '',
            receiptDate: scraped.receiptDate,
            receiptTime: scraped.receiptTime,
            totalExclTax: scraped.totalAmounts.find(t => t.label === 'TOTAL EXCL OF TAX:')?.amount || '0',
            totalTax: scraped.totalAmounts.find(t => t.label === 'TOTAL TAX:')?.amount || '0',
            totalInclTax: scraped.totalAmounts.find(t => t.label === 'TOTAL INCL OF TAX:')?.amount || '0',
            verificationCode: getReceiptDto.verificationCode,
            verificationCodeUrl: scraped.verificationUrl,
            pdfStatus: 'pending',
        };
        let insertedReceipt;
        try {
            const result = await this.db.insert(schema_1.receipts).values(newReceipt).returning();
            insertedReceipt = result[0];
        }
        catch (error) {
            if (error.code === '23505') {
                throw new common_1.ConflictException('This receipt has already been saved to your account.');
            }
            throw new common_1.InternalServerErrorException('Failed to save receipt to the database.');
        }
        if (scraped.items && scraped.items.length > 0) {
            const purchasedItemsToInsert = scraped.items.map(item => ({
                receiptId: insertedReceipt.id,
                description: item.description,
                quantity: item.qty,
                amount: item.amount,
            }));
            await this.db.insert(schema_1.purchasedItems).values(purchasedItemsToInsert);
        }
        await this.pdfQueue.enqueueJob({ receiptId: insertedReceipt.id, receiptData: { ...insertedReceipt, ...scraped } });
        return { status: 'queued', receiptId: insertedReceipt.id };
    }
    async findAll(user, options) {
        console.log('--- ReceiptsService.findAll ---');
        if (user) {
            console.log('Querying receipts for userId:', user.id, typeof user.id);
        }
        const { page, limit, companyName, customerName, tin } = options;
        const offset = (page - 1) * limit;
        const whereClauses = [];
        if (user) {
            whereClauses.push((0, drizzle_orm_1.eq)(schema_1.receipts.userId, user.id));
        }
        if (companyName) {
            whereClauses.push((0, drizzle_orm_1.ilike)(schema_1.receipts.companyName, `%${companyName}%`));
        }
        if (customerName) {
            whereClauses.push((0, drizzle_orm_1.ilike)(schema_1.receipts.customerName, `%${customerName}%`));
        }
        if (tin) {
            whereClauses.push((0, drizzle_orm_1.eq)(schema_1.receipts.tin, tin));
        }
        const dataQuery = this.db.select().from(schema_1.receipts).where((0, drizzle_orm_1.and)(...whereClauses.filter(c => c !== undefined))).limit(limit).offset(offset).orderBy((0, drizzle_orm_1.desc)(schema_1.receipts.createdAt));
        const countQuery = this.db.select({ count: (0, drizzle_orm_1.sql) `count(*)::int` }).from(schema_1.receipts).where((0, drizzle_orm_1.and)(...whereClauses.filter(c => c !== undefined)));
        const [data, countResult] = await Promise.all([dataQuery, countQuery]);
        const total = countResult[0].count;
        const lastPage = Math.ceil(total / limit) || 1;
        return {
            data,
            meta: { total, page, limit, lastPage },
        };
    }
    async getReceiptById(id, requestingUser) {
        const receiptId = Number(id);
        console.log('Fetching receipt by PK id:', receiptId, typeof receiptId);
        const receiptArr = await this.db.select().from(schema_1.receipts).where((0, drizzle_orm_1.eq)(schema_1.receipts.id, receiptId)).limit(1);
        const receipt = receiptArr[0];
        if (!receipt) {
            throw new common_1.NotFoundException('Receipt not found');
        }
        console.log('Checking ownership: receipt.userId =', receipt.userId, 'requestingUser.sub =', requestingUser.sub);
        if (requestingUser.role !== 'admin' && receipt.userId !== requestingUser.sub) {
            throw new common_1.UnauthorizedException('Not authorized to view this receipt');
        }
        console.log('Fetching purchased items for receiptId:', receiptId, typeof receiptId);
        const items = await this.db.select().from(schema_1.purchasedItems).where((0, drizzle_orm_1.eq)(schema_1.purchasedItems.receiptId, receiptId));
        return { ...receipt, items };
    }
    async deleteReceipt(id, requestingUser) {
        const receiptId = Number(id);
        console.log('Deleting receipt by PK id:', receiptId, typeof receiptId);
        const receiptArr = await this.db.select().from(schema_1.receipts).where((0, drizzle_orm_1.eq)(schema_1.receipts.id, receiptId)).limit(1);
        const receipt = receiptArr[0];
        if (!receipt) {
            throw new common_1.NotFoundException('Receipt not found');
        }
        if (requestingUser.role !== 'admin' && receipt.userId !== requestingUser.sub) {
            throw new common_1.UnauthorizedException('Not authorized to delete this receipt');
        }
        if (receipt.pdfUrl) {
            await this.fileUploadService.deleteFile(receipt.pdfUrl);
        }
        await this.db.delete(schema_1.receipts).where((0, drizzle_orm_1.eq)(schema_1.receipts.id, receiptId));
    }
    async exportReceiptPdf(id, requestingUser) {
        const receiptId = Number(id);
        console.log('Exporting PDF for receipt PK id:', receiptId, typeof receiptId);
        const receiptArr = await this.db.select().from(schema_1.receipts).where((0, drizzle_orm_1.eq)(schema_1.receipts.id, receiptId)).limit(1);
        const receipt = receiptArr[0];
        if (!receipt) {
            throw new common_1.NotFoundException('Receipt not found');
        }
        if (requestingUser.role !== 'admin' && receipt.userId !== requestingUser.sub) {
            throw new common_1.UnauthorizedException('Not authorized to export this receipt');
        }
        const items = await this.db.select().from(schema_1.purchasedItems).where((0, drizzle_orm_1.eq)(schema_1.purchasedItems.receiptId, receiptId));
        return Buffer.from(await this.pdfGenerator.generateReceiptPdf({ ...receipt, items }));
    }
};
exports.ReceiptsService = ReceiptsService;
exports.ReceiptsService = ReceiptsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(db_provider_1.DB_PROVIDER)),
    __metadata("design:paramtypes", [Object, scraper_service_1.ScraperService,
        pdf_queue_service_1.PdfQueueService,
        file_upload_service_1.FileUploadService,
        pdf_generator_service_1.PdfGeneratorService,
        playwright_service_1.PlaywrightService])
], ReceiptsService);
//# sourceMappingURL=receipts.service.js.map