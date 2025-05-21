"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptsService = void 0;
const common_1 = require("@nestjs/common");
const playwright_1 = require("playwright");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
let ReceiptsService = class ReceiptsService {
    browser = null;
    page = null;
    async onModuleInit() {
        this.browser = await playwright_1.chromium.launch();
        this.page = await this.browser.newPage();
    }
    async onModuleDestroy() {
        if (this.browser) {
            await this.browser.close();
        }
    }
    async getReceipt(verificationCode, receiptTime) {
        if (!this.page) {
            console.error('Playwright page not initialized.');
            return null;
        }
        const page = this.page;
        try {
            await page.goto(`https://verify.tra.go.tz/${verificationCode}`);
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
            const invoiceInfoTexts = await page.$$eval('div.invoice-info b', elements => elements.map(el => el.nextSibling?.textContent?.trim()));
            const address = invoiceInfoTexts[0];
            const mobile = invoiceInfoTexts[1];
            const tin = invoiceInfoTexts[2];
            const vrn = invoiceInfoTexts[3];
            const serialNo = invoiceInfoTexts[4];
            const uin = invoiceInfoTexts[5];
            const taxOffice = invoiceInfoTexts[6];
            const customerInfoTexts = await page.$$eval('div.invoice-info p', elements => elements.map(el => el.textContent?.trim()));
            const customerName = customerInfoTexts[0]?.split(':')[1]?.trim();
            const customerIdType = customerInfoTexts[1]?.split(':')[1]?.trim();
            const customerId = customerInfoTexts[2]?.split(':')[1]?.trim();
            const customerMobile = customerInfoTexts[3]?.split(':')[1]?.trim();
            const receiptNoElement = await page.$('div.invoice-detail p:nth-child(1)');
            const zNumberElement = await page.$('div.invoice-detail p:nth-child(2)');
            const receiptDateElement = await page.$('div.invoice-detail p:nth-child(3)');
            const extractedReceiptTimeElement = await page.$('div.invoice-detail p:nth-child(4)');
            const receiptNo = (await receiptNoElement?.textContent())?.split(':')[1]?.trim();
            const zNumber = (await zNumberElement?.textContent())?.split(':')[1]?.trim();
            const receiptDate = (await receiptDateElement?.textContent())?.split(':')[1]?.trim();
            const extractedReceiptTime = (await extractedReceiptTimeElement?.textContent())?.split(':')[1]?.trim();
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
                return rows.map(row => {
                    const cols = row.querySelectorAll('td');
                    return {
                        label: (row.querySelector('th')?.textContent || '').trim(),
                        amount: (cols[0]?.textContent || '').trim(),
                    };
                });
            });
            const receiptData = JSON.stringify({
                companyName,
                address,
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
                receiptData,
            };
            const result = await db_1.db.insert(schema_1.receipts).values(newReceipt).returning();
            return result[0];
        }
        catch (error) {
            console.error('Error during scraping:', error);
            return null;
        }
    }
};
exports.ReceiptsService = ReceiptsService;
exports.ReceiptsService = ReceiptsService = __decorate([
    (0, common_1.Injectable)()
], ReceiptsService);
//# sourceMappingURL=receipts.service.js.map