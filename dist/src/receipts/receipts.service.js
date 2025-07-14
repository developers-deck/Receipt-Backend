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
const playwright_1 = require("playwright");
const db_provider_1 = require("../db/db.provider");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const config_1 = require("@nestjs/config");
const file_upload_service_1 = require("../file-upload/file-upload.service");
const async_mutex_1 = require("async-mutex");
const pdf_generator_service_1 = require("./pdf-generator.service");
const scraper_service_1 = require("./scraper.service");
const pdf_queue_service_1 = require("./pdf-queue.service");
function safeClosePage(page) {
    if (page) {
        return page.close().catch((err) => {
            console.error('Error closing page during cleanup:', err);
        });
    }
    return Promise.resolve();
}
function safeCloseBrowser(browser) {
    if (browser) {
        return browser.close().catch((err) => {
            console.error('Error closing browser during cleanup:', err);
        });
    }
    return Promise.resolve();
}
let ReceiptsService = class ReceiptsService {
    db;
    configService;
    fileUploadService;
    pdfGenerator;
    scraper;
    pdfQueue;
    browser = null;
    browserInitLock = new async_mutex_1.Mutex();
    constructor(db, configService, fileUploadService, pdfGenerator, scraper, pdfQueue) {
        this.db = db;
        this.configService = configService;
        this.fileUploadService = fileUploadService;
        this.pdfGenerator = pdfGenerator;
        this.scraper = scraper;
        this.pdfQueue = pdfQueue;
    }
    async onModuleInit() {
        await this.initializeBrowser();
    }
    async initializeBrowser() {
        return this.browserInitLock.runExclusive(async () => {
            try {
                if (this.browser) {
                    console.log('Closing existing Playwright browser instance.');
                    await safeCloseBrowser(this.browser);
                    this.browser = null;
                }
                console.log('Attempting to launch Playwright browser...');
                this.browser = await playwright_1.chromium.launch({
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--disable-software-rasterizer',
                        '--disable-extensions',
                        '--single-process',
                        '--no-zygote',
                        '--disable-web-security',
                        '--disable-features=IsolateOrigins,site-per-process'
                    ],
                    headless: true,
                    timeout: 60000,
                    ignoreDefaultArgs: ['--disable-extensions'],
                    chromiumSandbox: false
                });
                console.log('Playwright browser launched successfully.');
            }
            catch (error) {
                console.error('Failed to initialize Playwright:', error);
                await safeCloseBrowser(this.browser);
                this.browser = null;
                throw error;
            }
        });
    }
    async onModuleDestroy() {
        await safeCloseBrowser(this.browser);
    }
    async getReceiptsByUserId(userId) {
        const userReceipts = await this.db.select().from(schema_1.receipts).where((0, drizzle_orm_1.eq)(schema_1.receipts.userId, userId));
        if (!userReceipts || userReceipts.length === 0) {
            return [];
        }
        const receiptIds = userReceipts.map(r => r.id);
        const allItems = receiptIds.length > 0
            ? await this.db.select().from(schema_1.purchasedItems).where((0, drizzle_orm_1.inArray)(schema_1.purchasedItems.receiptId, receiptIds))
            : [];
        const itemsByReceipt = new Map();
        allItems.forEach(item => {
            if (!itemsByReceipt.has(item.receiptId))
                itemsByReceipt.set(item.receiptId, []);
            itemsByReceipt.get(item.receiptId).push(item);
        });
        return userReceipts.map(receipt => ({
            ...receipt,
            items: itemsByReceipt.get(receipt.id) || []
        }));
    }
    async getAllReceipts() {
        const allReceipts = await this.db.select().from(schema_1.receipts);
        if (!allReceipts || allReceipts.length === 0) {
            return [];
        }
        const receiptIds = allReceipts.map(r => r.id);
        const allItems = receiptIds.length > 0
            ? await this.db.select().from(schema_1.purchasedItems).where((0, drizzle_orm_1.inArray)(schema_1.purchasedItems.receiptId, receiptIds))
            : [];
        const itemsByReceipt = new Map();
        allItems.forEach(item => {
            if (!itemsByReceipt.has(item.receiptId))
                itemsByReceipt.set(item.receiptId, []);
            itemsByReceipt.get(item.receiptId).push(item);
        });
        return allReceipts.map(receipt => ({
            ...receipt,
            items: itemsByReceipt.get(receipt.id) || []
        }));
    }
    async getReceipt(verificationCode, receiptTime, userId) {
        if (!this.browser) {
            throw new common_1.ServiceUnavailableException('Browser is not initialized.');
        }
        const page = await this.browser.newPage();
        try {
            const traVerifyUrl = this.configService.get('TRA_VERIFY_URL') || '';
            const scraped = await this.scraper.scrapeReceipt(page, verificationCode, receiptTime, traVerifyUrl);
            const newReceipt = {
                userId,
                verificationCode,
                receiptTime,
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
                totalExclTax: scraped.totalAmounts.find(t => t.label === 'TOTAL EXCL OF TAX:')?.amount || '0',
                totalTax: scraped.totalAmounts.find(t => t.label === 'TOTAL TAX:')?.amount || '0',
                totalInclTax: scraped.totalAmounts.find(t => t.label === 'TOTAL INCL OF TAX:')?.amount || '0',
                verificationCodeUrl: `${traVerifyUrl}/${verificationCode}`,
                pdfStatus: 'pending',
            };
            const result = await this.db.insert(schema_1.receipts).values(newReceipt).returning();
            const insertedReceipt = result[0];
            if (!insertedReceipt) {
                throw new common_1.InternalServerErrorException('Failed to save receipt to the database.');
            }
            if (scraped.items && scraped.items.length > 0) {
                const purchasedItemsToInsert = scraped.items.map(item => ({
                    receiptId: insertedReceipt.id,
                    description: item.description,
                    quantity: item.qty,
                    amount: item.amount,
                }));
                if (purchasedItemsToInsert.length > 0) {
                    await this.db.insert(schema_1.purchasedItems).values(purchasedItemsToInsert);
                }
            }
            await this.pdfQueue.enqueueJob({ receiptId: insertedReceipt.id, receiptData: { ...insertedReceipt, items: scraped.items } });
            return { status: 'queued', receiptId: insertedReceipt.id };
        }
        finally {
            await safeClosePage(page);
        }
    }
    async getReceiptById(id) {
        const receiptId = parseInt(id, 10);
        if (isNaN(receiptId)) {
            return null;
        }
        const receipt = await this.db.select().from(schema_1.receipts).where((0, drizzle_orm_1.eq)(schema_1.receipts.id, receiptId)).limit(1);
        if (!receipt || receipt.length === 0) {
            return null;
        }
        const purchasedItemsForReceipt = await this.db.select().from(schema_1.purchasedItems).where((0, drizzle_orm_1.eq)(schema_1.purchasedItems.receiptId, receiptId));
        return { ...receipt[0], items: purchasedItemsForReceipt };
    }
    async generateReceiptPdf(receiptData) {
        if (!this.browser) {
            throw new common_1.ServiceUnavailableException('Browser is not initialized for PDF generation.');
        }
        const page = await this.browser.newPage();
        try {
            const htmlContent = await this.pdfGenerator.generateReceiptPdf(receiptData);
            await page.setContent(htmlContent, { waitUntil: 'networkidle' });
            return await page.pdf({ format: 'A4', printBackground: true });
        }
        finally {
            await safeClosePage(page);
        }
    }
    async getReceiptsByCompanyName(companyName) {
        const matchingReceipts = await this.db.select().from(schema_1.receipts).where((0, drizzle_orm_1.eq)(schema_1.receipts.companyName, companyName));
        if (!matchingReceipts || matchingReceipts.length === 0) {
            return [];
        }
        const receiptIds = matchingReceipts.map(r => r.id);
        const allItems = receiptIds.length > 0
            ? await this.db.select().from(schema_1.purchasedItems).where((0, drizzle_orm_1.inArray)(schema_1.purchasedItems.receiptId, receiptIds))
            : [];
        const itemsByReceipt = new Map();
        allItems.forEach(item => {
            if (!itemsByReceipt.has(item.receiptId))
                itemsByReceipt.set(item.receiptId, []);
            itemsByReceipt.get(item.receiptId).push(item);
        });
        return matchingReceipts.map(receipt => ({
            ...receipt,
            items: itemsByReceipt.get(receipt.id) || []
        }));
    }
};
exports.ReceiptsService = ReceiptsService;
exports.ReceiptsService = ReceiptsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(db_provider_1.DB_PROVIDER)),
    __metadata("design:paramtypes", [Object, config_1.ConfigService,
        file_upload_service_1.FileUploadService,
        pdf_generator_service_1.PdfGeneratorService,
        scraper_service_1.ScraperService,
        pdf_queue_service_1.PdfQueueService])
], ReceiptsService);
//# sourceMappingURL=receipts.service.js.map