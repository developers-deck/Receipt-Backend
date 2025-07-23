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
var ReceiptsService_1;
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
let ReceiptsService = ReceiptsService_1 = class ReceiptsService {
    db;
    scraper;
    pdfQueue;
    fileUploadService;
    pdfGenerator;
    playwrightService;
    logger = new common_1.Logger(ReceiptsService_1.name);
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
        console.log('newReceipt:', newReceipt);
        let insertedReceipt;
        try {
            const result = await this.db.insert(schema_1.receipts).values(newReceipt).returning();
            insertedReceipt = result[0];
        }
        catch (error) {
            if (error.code === '23505') {
                throw new common_1.ConflictException('This receipt has already been saved to your account.');
            }
            console.error('Error saving receipt to DB:', error);
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
    async getUserStats(user) {
        const receiptsList = await this.db.select().from(schema_1.receipts).where((0, drizzle_orm_1.eq)(schema_1.receipts.userId, user.id));
        const parseNum = (val) => {
            if (!val)
                return 0;
            return Number(val.replace(/,/g, ''));
        };
        const sum = receiptsList.reduce((acc, r) => {
            acc.totalTax += parseNum(r.totalTax);
            acc.totalInclTax += parseNum(r.totalInclTax);
            acc.totalExclTax += parseNum(r.totalExclTax);
            return acc;
        }, { totalTax: 0, totalInclTax: 0, totalExclTax: 0 });
        const receiptsData = receiptsList.map(r => ({
            id: r.id,
            companyName: r.companyName,
            totalTax: parseNum(r.totalTax),
            totalInclTax: parseNum(r.totalInclTax),
            totalExclTax: parseNum(r.totalExclTax),
            receiptDate: r.receiptDate,
            receiptNo: r.receiptNo,
            customerName: r.customerName,
        }));
        const companyTax = {};
        receiptsList.forEach(r => {
            const company = r.companyName || 'Unknown';
            const tax = parseNum(r.totalTax);
            if (!companyTax[company])
                companyTax[company] = 0;
            companyTax[company] += tax;
        });
        return { sum, receipts: receiptsData, companyTax };
    }
    async retryPdfGeneration(receiptId, userId) {
        this.logger.log(`Retrying PDF generation for receipt ID: ${receiptId}`);
        const receipt = await this.db.query.receipts.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.receipts.id, receiptId), (0, drizzle_orm_1.eq)(schema_1.receipts.userId, userId)),
        });
        if (!receipt) {
            throw new common_1.NotFoundException(`Receipt with ID ${receiptId} not found or does not belong to this user`);
        }
        if (receipt.pdfStatus !== 'failed' && receipt.pdfStatus !== 'retry_pending') {
            this.logger.warn(`Cannot retry PDF generation for receipt ID: ${receiptId} with status: ${receipt.pdfStatus}`);
            return {
                status: 'error',
                message: `Cannot retry PDF generation for receipt with status: ${receipt.pdfStatus}. Only failed or retry_pending receipts can be retried.`
            };
        }
        await this.db.update(schema_1.receipts)
            .set({ pdfStatus: 'pending' })
            .where((0, drizzle_orm_1.eq)(schema_1.receipts.id, receiptId));
        const browser = await this.playwrightService.getBrowser();
        const page = await browser.newPage();
        let scraped;
        try {
            const traVerifyUrl = process.env.TRA_VERIFY_URL;
            if (!traVerifyUrl) {
                throw new Error('TRA_VERIFY_URL environment variable is not set.');
            }
            if (!receipt.receiptTime) {
                throw new Error(`Receipt ${receipt.id} has no receiptTime - cannot retry PDF generation`);
            }
            scraped = await this.scraper.scrapeReceipt(page, receipt.verificationCode, receipt.receiptTime, traVerifyUrl);
            await this.pdfQueue.enqueueJob({
                receiptId: receipt.id,
                receiptData: { ...receipt, ...scraped }
            });
            return { status: 'queued', receiptId: receipt.id };
        }
        catch (error) {
            this.logger.error(`Failed to retry PDF generation for receipt ID: ${receiptId}`, error);
            await this.db.update(schema_1.receipts)
                .set({ pdfStatus: 'failed' })
                .where((0, drizzle_orm_1.eq)(schema_1.receipts.id, receiptId));
            throw new common_1.ServiceUnavailableException(`Failed to retry PDF generation: ${error.message}`);
        }
        finally {
            await page.close();
        }
    }
    async retryAllFailedPdfGenerations(userId) {
        this.logger.log(`Retrying all failed PDF generations for user ID: ${userId}`);
        const failedReceipts = await this.db.query.receipts.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.receipts.userId, userId), (0, drizzle_orm_1.sql) `${schema_1.receipts.pdfStatus} IN ('failed', 'retry_pending')`),
        });
        if (failedReceipts.length === 0) {
            return { status: 'success', message: 'No failed receipts found to retry', count: 0 };
        }
        let successCount = 0;
        let failureCount = 0;
        for (const receipt of failedReceipts) {
            try {
                await this.db.update(schema_1.receipts)
                    .set({ pdfStatus: 'pending' })
                    .where((0, drizzle_orm_1.eq)(schema_1.receipts.id, receipt.id));
                const browser = await this.playwrightService.getBrowser();
                const page = await browser.newPage();
                try {
                    const traVerifyUrl = process.env.TRA_VERIFY_URL;
                    if (!traVerifyUrl) {
                        throw new Error('TRA_VERIFY_URL environment variable is not set.');
                    }
                    if (!receipt.receiptTime) {
                        throw new Error(`Receipt ${receipt.id} has no receiptTime - cannot retry PDF generation`);
                    }
                    const scraped = await this.scraper.scrapeReceipt(page, receipt.verificationCode, receipt.receiptTime, traVerifyUrl);
                    await this.pdfQueue.enqueueJob({
                        receiptId: receipt.id,
                        receiptData: { ...receipt, ...scraped }
                    });
                    successCount++;
                }
                catch (error) {
                    this.logger.error(`Failed to retry PDF generation for receipt ID: ${receipt.id}`, error);
                    await this.db.update(schema_1.receipts)
                        .set({ pdfStatus: 'failed' })
                        .where((0, drizzle_orm_1.eq)(schema_1.receipts.id, receipt.id));
                    failureCount++;
                }
                finally {
                    await page.close();
                }
            }
            catch (error) {
                this.logger.error(`Error processing receipt ID: ${receipt.id}`, error);
                failureCount++;
            }
        }
        return {
            status: 'success',
            message: `Queued ${successCount} receipts for PDF generation retry. Failed to queue ${failureCount} receipts.`,
            count: successCount
        };
    }
};
exports.ReceiptsService = ReceiptsService;
exports.ReceiptsService = ReceiptsService = ReceiptsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(db_provider_1.DB_PROVIDER)),
    __metadata("design:paramtypes", [Object, scraper_service_1.ScraperService,
        pdf_queue_service_1.PdfQueueService,
        file_upload_service_1.FileUploadService,
        pdf_generator_service_1.PdfGeneratorService,
        playwright_service_1.PlaywrightService])
], ReceiptsService);
//# sourceMappingURL=receipts.service.js.map