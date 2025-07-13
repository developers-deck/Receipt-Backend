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
let ReceiptsService = class ReceiptsService {
    db;
    configService;
    browser = null;
    page = null;
    constructor(db, configService) {
        this.db = db;
        this.configService = configService;
    }
    async onModuleInit() {
        await this.initializeBrowser();
    }
    async initializeBrowser() {
        try {
            if (this.browser) {
                console.log('Closing existing Playwright browser instance.');
                await this.browser.close();
                this.browser = null;
                this.page = null;
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
            console.log('Playwright browser launched. Creating new page...');
            this.page = await this.browser.newPage();
            await this.page.setViewportSize({ width: 1280, height: 800 });
            console.log('Playwright browser and page initialized successfully.');
        }
        catch (error) {
            console.error('Failed to initialize Playwright:', error);
            if (this.page) {
                try {
                    await this.page.close();
                }
                catch (closePageError) {
                    console.error('Error closing page during cleanup:', closePageError);
                }
                this.page = null;
            }
            if (this.browser) {
                try {
                    await this.browser.close();
                }
                catch (closeBrowserError) {
                    console.error('Error closing browser during cleanup:', closeBrowserError);
                }
                this.browser = null;
            }
            throw error;
        }
    }
    async onModuleDestroy() {
        if (this.browser) {
            await this.browser.close();
        }
    }
    async getAllReceipts() {
        const allReceipts = await this.db.select().from(schema_1.receipts);
        const receiptIds = allReceipts.map(r => r.id);
        const allItems = receiptIds.length > 0
            ? await this.db.select().from(schema_1.purchasedItems).where((0, drizzle_orm_1.inArray)(schema_1.purchasedItems.receiptId, receiptIds))
            : [];
        return allReceipts.map(receipt => ({
            ...receipt,
            items: allItems.filter(item => item.receiptId === receipt.id)
        }));
    }
    async getReceipt(verificationCode, receiptTime) {
        if (!this.page) {
            console.log('Playwright page not initialized. Attempting to reinitialize...');
            await this.initializeBrowser();
            if (!this.page) {
                console.error('Failed to initialize Playwright page after retry.');
                throw new common_1.ServiceUnavailableException('Failed to initialize browser service.');
            }
        }
        const page = this.page;
        try {
            const traVerifyUrl = this.configService.get('TRA_VERIFY_URL');
            await page.goto(`${traVerifyUrl}/${verificationCode}`, { timeout: 60000, waitUntil: 'domcontentloaded' });
            const hourSelect = await page.$('#HH');
            if (hourSelect) {
                const [hour, minute] = receiptTime.split(':');
                await hourSelect.selectOption(hour);
                await page.selectOption('#MM', minute);
                if ((await page.$('#SS')) && receiptTime.split(':').length > 2) {
                    await page.selectOption('#SS', receiptTime.split(':')[2]);
                }
                const submitButtonSelector = 'button[type="submit"]';
                await page.waitForSelector(submitButtonSelector, { state: 'visible', timeout: 60000 });
                await page.click(submitButtonSelector, { timeout: 60000 });
                await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 });
            }
            const receiptContainer = await page.$('.receipt-container');
            if (!receiptContainer) {
                throw new common_1.NotFoundException('A receipt with the provided details could not be found.');
            }
            const companyName = await receiptContainer.$eval('.card-header h3', el => el.textContent?.trim());
            const poBox = await receiptContainer.$eval('.card-header p:nth-of-type(1)', el => el.textContent?.trim());
            const mobile = await receiptContainer.$eval('.card-header p:nth-of-type(2)', el => el.textContent?.trim());
            const details = await receiptContainer.$$eval('.card-body .row .col-md-6', (cols) => {
                const data = {};
                cols.forEach(col => {
                    const label = col.querySelector('p strong')?.textContent?.trim();
                    const value = col.querySelector('p:nth-of-type(2)')?.textContent?.trim();
                    if (label && value) {
                        data[label] = value;
                    }
                });
                return data;
            });
            const items = await receiptContainer.$$eval('table.table-condensed tbody tr', rows => rows.map(row => {
                const cols = row.querySelectorAll('td');
                return {
                    description: (cols[0]?.textContent || '').trim(),
                    qty: (cols[1]?.textContent || '').trim(),
                    amount: (cols[2]?.textContent || '').trim(),
                };
            }));
            const totalAmounts = await receiptContainer.$$eval('table.table.mt-5 tbody tr', rows => rows.map(row => {
                const label = (row.querySelector('td:first-child')?.textContent || '').trim();
                const amount = (row.querySelector('td:last-child')?.textContent || '').trim();
                return { label, amount };
            }));
            const receiptDateTime = details['Date & Time:'] || '';
            const [receiptDate] = receiptDateTime.split(' ');
            const newReceipt = {
                verificationCode,
                receiptTime,
                companyName,
                poBox,
                mobile,
                tin: details['TIN:'] || '',
                vrn: details['VRN:'] || '',
                serialNo: details['Serial No:'] || '',
                uin: details['UIN:'] || '',
                taxOffice: details['Tax Office:'] || '',
                customerName: details['Customer Name:'] || '',
                customerIdType: details['Customer ID Type:'] || '',
                customerId: details['Customer ID:'] || '',
                customerMobile: details['Customer Mobile:'] || '',
                receiptNo: details['Receipt No:'] || '',
                zNumber: details['Z-Number:'] || '',
                receiptDate,
                totalExclTax: totalAmounts.find(t => t.label === 'TOTAL EXCL OF TAX:')?.amount || '0',
                totalTax: totalAmounts.find(t => t.label === 'TOTAL TAX:')?.amount || '0',
                totalInclTax: totalAmounts.find(t => t.label === 'TOTAL INCL OF TAX:')?.amount || '0',
                verificationCodeUrl: `${this.configService.get('TRA_VERIFY_URL')}/${verificationCode}`,
            };
            const result = await this.db.insert(schema_1.receipts).values(newReceipt).returning();
            const insertedReceipt = result[0];
            if (!insertedReceipt) {
                throw new common_1.InternalServerErrorException('Failed to save receipt to the database.');
            }
            if (items && items.length > 0) {
                const purchasedItemsToInsert = items.map(item => ({
                    receiptId: insertedReceipt.id,
                    description: item.description,
                    quantity: item.qty,
                    amount: item.amount,
                }));
                await this.db.insert(schema_1.purchasedItems).values(purchasedItemsToInsert);
            }
            return insertedReceipt;
        }
        catch (error) {
            console.error(`Error during scraping for ${verificationCode}:`, error);
            if (error.name === 'TimeoutError') {
                throw new common_1.GatewayTimeoutException('The verification took too long to respond. Please try again later.');
            }
            if (error instanceof common_1.NotFoundException || error instanceof common_1.InternalServerErrorException || error instanceof common_1.ServiceUnavailableException) {
                throw error;
            }
            throw new common_1.ServiceUnavailableException('An unexpected error occurred while getting the receipt data.');
        }
    }
    async getReceiptById(id) {
        const receipt = await this.db.select().from(schema_1.receipts).where((0, drizzle_orm_1.eq)(schema_1.receipts.id, id)).limit(1);
        if (!receipt || receipt.length === 0) {
            return null;
        }
        const purchasedItemsForReceipt = await this.db.select().from(schema_1.purchasedItems).where((0, drizzle_orm_1.eq)(schema_1.purchasedItems.receiptId, id));
        return { ...receipt[0], items: purchasedItemsForReceipt };
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
        return matchingReceipts.map(receipt => ({
            ...receipt,
            items: allItems.filter(item => item.receiptId === receipt.id)
        }));
    }
};
exports.ReceiptsService = ReceiptsService;
exports.ReceiptsService = ReceiptsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(db_provider_1.DB_PROVIDER)),
    __metadata("design:paramtypes", [Object, config_1.ConfigService])
], ReceiptsService);
//# sourceMappingURL=receipts.service.js.map