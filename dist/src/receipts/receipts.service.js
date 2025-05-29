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
let ReceiptsService = class ReceiptsService {
    db;
    browser = null;
    page = null;
    constructor(db) {
        this.db = db;
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
                    '--no-zygote'
                ],
                headless: true,
                timeout: 60000
            });
            console.log('Playwright browser launched. Creating new page...');
            this.page = await this.browser.newPage();
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
                return null;
            }
        }
        const page = this.page;
        try {
            await page.goto(`https://verify.tra.go.tz/${verificationCode}`, { timeout: 60000, waitUntil: 'domcontentloaded' });
            console.log(`Navigated to https://verify.tra.go.tz/${verificationCode}`);
            console.log('Page title:', await page.title());
            const hourSelect = await page.$('#HH');
            const minuteSelect = await page.$('#MM');
            const secondSelect = await page.$('#SS');
            if (!hourSelect || !minuteSelect || !secondSelect) {
                console.error('Verification code not found or invalid, or time inputs not found.');
                return null;
            }
            const [hour, minute, second] = receiptTime.split(':');
            await hourSelect.selectOption(hour);
            await minuteSelect.selectOption(minute);
            await secondSelect.selectOption(second);
            console.log(`Selected time: ${hour}:${minute}:${second}`);
            await page.click('button[onclick="validateSecret()"]');
            await page.waitForSelector('div.invoice-header center h4 b', { timeout: 30000 });
            console.log('Clicked submit button and waiting for navigation.');
            console.log('Current URL after navigation:', page.url());
            const pageContent = await page.content();
            console.log('Page Content after navigation:', pageContent);
            const companyName = await page.$eval('div.invoice-header center h4 b', el => el.textContent?.trim());
            console.log('Extracted companyName:', companyName);
            const poBox = await page.$eval('div.invoice-info b', el => el.textContent?.trim());
            console.log('Extracted poBox:', poBox);
            const invoiceInfoElements = await page.$$('div.invoice-info b');
            const invoiceInfoTexts = await Promise.all(invoiceInfoElements.slice(1).map(async (el) => {
                const nextSiblingText = await page.evaluate(element => element.nextSibling?.textContent?.trim(), el);
                return nextSiblingText;
            }));
            console.log('Raw invoiceInfoTexts:', invoiceInfoTexts);
            const mobile = invoiceInfoTexts[0];
            const tin = invoiceInfoTexts[1];
            const vrn = invoiceInfoTexts[2];
            const serialNo = invoiceInfoTexts[3];
            const uin = invoiceInfoTexts[4];
            const taxOffice = invoiceInfoTexts[5];
            async function extractSiblingText(page, label) {
                return await page.evaluate(labelText => {
                    const bTags = Array.from(document.querySelectorAll('div.invoice-header b'));
                    const target = bTags.find(b => b.textContent && b.textContent.trim().toUpperCase() === labelText);
                    return target && target.nextSibling && target.nextSibling.textContent ? target.nextSibling.textContent.trim() : null;
                }, label);
            }
            const customerName = await extractSiblingText(page, 'CUSTOMER NAME:');
            console.log('Extracted customerName:', customerName);
            const customerIdType = await extractSiblingText(page, 'CUSTOMER ID TYPE:');
            console.log('Extracted customerIdType:', customerIdType);
            const customerId = await extractSiblingText(page, 'CUSTOMER ID:');
            console.log('Extracted customerId:', customerId);
            const customerMobile = await extractSiblingText(page, 'CUSTOMER MOBILE:');
            console.log('Extracted customerMobile:', customerMobile);
            const receiptNo = await extractSiblingText(page, 'RECEIPT NO:');
            console.log('Extracted receiptNo:', receiptNo);
            const zNumber = await extractSiblingText(page, 'Z NUMBER:');
            console.log('Extracted zNumber:', zNumber);
            const receiptDate = await extractSiblingText(page, 'RECEIPT DATE:');
            console.log('Extracted receiptDate:', receiptDate);
            const extractedReceiptTime = await extractSiblingText(page, 'RECEIPT TIME:');
            console.log('Extracted extractedReceiptTime:', extractedReceiptTime);
            const items = await page.$$eval('table.table-striped tbody tr', rows => {
                return rows.map(row => {
                    const cols = row.querySelectorAll('td');
                    return {
                        description: (cols[0]?.textContent || '').trim(),
                        qty: (cols[1]?.textContent || '').trim(),
                        amount: (cols[2]?.textContent || '').trim(),
                    };
                });
            });
            const totalAmounts = await page.$$eval('table.table tbody tr', rows => {
                console.log('Raw totalAmounts rows:', rows.map(row => row.textContent?.trim()));
                return rows.map(row => {
                    const cols = row.querySelectorAll('td');
                    const label = (row.querySelector('th')?.textContent || '').trim();
                    const amount = (cols[0]?.textContent || '').trim();
                    if (label === '') {
                        const totalRow = rows.find(r => r.querySelector('th')?.textContent?.trim() === 'Total Amount');
                        if (totalRow) {
                            const totalCols = totalRow.querySelectorAll('td');
                            return {
                                label: 'SUMMARIZED SALE - E',
                                amount: (totalCols[0]?.textContent || '').trim()
                            };
                        }
                    }
                    return {
                        label,
                        amount,
                    };
                });
            });
            console.log('Extracted totalAmounts:', totalAmounts);
            const receiptData = JSON.stringify({
                companyName,
                poBox,
                mobile,
                tin,
                vrn,
                serialNo,
                uin,
                taxOffice,
                customerName,
                customerIdType,
                customerId,
                customerMobile,
                receiptNo,
                zNumber,
                receiptDate,
                receiptTime: extractedReceiptTime,
                items,
                totalAmounts,
            }, null, 2);
            console.log('Extracted Receipt Data:', receiptData);
            const newReceipt = {
                verificationCode,
                receiptTime,
                companyName,
                poBox,
                mobile,
                tin,
                vrn,
                serialNo,
                uin,
                taxOffice,
                customerName,
                customerIdType,
                customerId,
                customerMobile,
                receiptNo,
                zNumber,
                receiptDate,
                totalExclTax: totalAmounts.find(t => t.label === 'TOTAL EXCL OF TAX:')?.amount || '0',
                totalTax: totalAmounts.find(t => t.label === 'TOTAL TAX:')?.amount || '0',
                totalInclTax: totalAmounts.find(t => t.label === 'TOTAL INCL OF TAX:')?.amount || '0',
                verificationCodeUrl: `https://verify.tra.go.tz/${verificationCode}`
            };
            try {
                const result = await this.db.insert(schema_1.receipts).values(newReceipt).returning();
                console.log('Database insertion result:', result);
                if (result && result[0]) {
                    const insertedReceipt = result[0];
                    if (items && items.length > 0) {
                        const purchasedItemsToInsert = items.map(item => ({
                            receiptId: insertedReceipt.id,
                            description: item.description,
                            quantity: item.qty,
                            amount: item.amount,
                        }));
                        await this.db.insert(schema_1.purchasedItems).values(purchasedItemsToInsert);
                        console.log(`Inserted ${items.length} purchased items.`);
                    }
                    return insertedReceipt;
                }
                else {
                    console.error('Database insertion did not return a result.');
                    return null;
                }
            }
            catch (dbError) {
                console.error('Database insertion error:', dbError);
                return null;
            }
        }
        catch (error) {
            console.error('Error during scraping:', error);
            return null;
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
    __metadata("design:paramtypes", [Object])
], ReceiptsService);
//# sourceMappingURL=receipts.service.js.map