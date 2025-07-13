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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptsService = exports.CreateReceiptDto = void 0;
const common_1 = require("@nestjs/common");
const node_postgres_1 = require("drizzle-orm/node-postgres");
const schema = require("../db/schema");
const drizzle_provider_1 = require("../db/drizzle.provider");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
const axios_2 = require("axios");
const cheerio = require("cheerio");
const tough_cookie_1 = require("tough-cookie");
const axios_cookiejar_support_1 = require("axios-cookiejar-support");
const drizzle_orm_1 = require("drizzle-orm");
class CreateReceiptDto {
    verificationSecret;
}
exports.CreateReceiptDto = CreateReceiptDto;
const common_2 = require("@nestjs/common");
const schema_1 = require("../db/schema");
const drizzle_orm_2 = require("drizzle-orm");
let ReceiptsService = ReceiptsService_1 = class ReceiptsService {
    db;
    httpService;
    logger = new common_1.Logger(ReceiptsService_1.name);
    traBaseUrl = 'https://verify.tra.go.tz/Verify/Verified';
    httpServiceWithCookies;
    constructor(db, httpService) {
        this.db = db;
        this.httpService = httpService;
        this.httpServiceWithCookies = (0, axios_cookiejar_support_1.wrapper)(this.httpService.axiosRef);
    }
    cleanText(text) {
        return text ? text.trim() : '';
    }
    parseAmount(amountString) {
        if (!amountString)
            return 0;
        return parseFloat(amountString.replace(/[^0-9.]/g, '')) || 0;
    }
    async fetchVerificationData(verificationCode) {
        const url = `https://verify.tra.go.tz/${verificationCode}`;
        this.logger.log(`Fetching verification data from TRA with URL: ${url}`);
        const cookieJar = new tough_cookie_1.CookieJar();
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpServiceWithCookies.get(url, { responseType: 'text', jar: cookieJar }));
            this.logger.log(`Verification data response status: ${response.status}`);
            if (response.status === 200 && typeof response.data === 'string') {
                return cookieJar;
            }
        }
        catch (error) {
            this.logger.error('Error fetching verification data:', error);
        }
        return cookieJar;
    }
    async fetchReceiptData(verificationSecret, cookieJar) {
        const url = `https://verify.tra.go.tz/Verify/Verified?Secret=${encodeURIComponent(verificationSecret)}`;
        this.logger.log(`Fetching receipt data from TRA with URL: ${url}`);
        try {
            const response = await (0, rxjs_1.firstValueFrom)(this.httpServiceWithCookies.get(url, { responseType: 'text', jar: cookieJar }));
            this.logger.log(`Receipt data response status: ${response.status}`);
            if (response.status === 200 && typeof response.data === 'string') {
                const htmlContent = response.data;
                this.logger.debug(`HTML Content: ${htmlContent}`);
                const $ = cheerio.load(htmlContent);
                const extractedData = {};
                extractedData.supplierName = this.cleanText($('div.invoice-header center h4 b').first().text());
                const supplierInfoBlock = $('div.invoice-info div.invoice-col');
                if (supplierInfoBlock.length > 0) {
                    extractedData.supplierTin = this.extractTextAfterB(supplierInfoBlock, 'TIN:');
                    extractedData.supplierVrn = this.extractTextAfterB(supplierInfoBlock, 'VRN:');
                    extractedData.supplierSerialNo = this.extractTextAfterB(supplierInfoBlock, 'SERIAL NO:');
                    extractedData.supplierUin = this.extractTextAfterB(supplierInfoBlock, 'UIN:');
                    extractedData.supplierTaxOffice = this.extractTextAfterB(supplierInfoBlock, 'TAX OFFICE:');
                    extractedData.supplierMobile = this.extractTextAfterB(supplierInfoBlock, 'MOBILE:');
                    extractedData.supplierPoBox = this.extractTextAfterB(supplierInfoBlock, 'P.O BOX');
                }
                else {
                    this.logger.warn('Supplier info block not found.');
                }
                const customerInfoBlock = $('div.invoice-header').next();
                if (customerInfoBlock.length > 0) {
                    extractedData.customerName = this.extractTextAfterB(customerInfoBlock, 'CUSTOMER NAME:');
                    extractedData.customerIdType = this.extractTextAfterB(customerInfoBlock, 'CUSTOMER ID TYPE:');
                    extractedData.customerId = this.extractTextAfterB(customerInfoBlock, 'CUSTOMER ID:');
                    extractedData.customerMobile = this.extractTextAfterB(customerInfoBlock, 'CUSTOMER MOBILE:');
                }
                else {
                    this.logger.warn('Customer info block not found.');
                }
                const receiptDetailsBlock = $('div.invoice-header').next().next();
                if (receiptDetailsBlock.length > 0) {
                    extractedData.traReceiptNo = this.extractTextAfterB(receiptDetailsBlock, 'RECEIPT NO:');
                    extractedData.traZNumber = this.extractTextAfterB(receiptDetailsBlock, 'Z NUMBER:');
                    extractedData.traReceiptDate = this.extractTextAfterB(receiptDetailsBlock, 'RECEIPT DATE:');
                    extractedData.traReceiptTime = this.extractTextAfterB(receiptDetailsBlock, 'RECEIPT TIME:');
                }
                else {
                    this.logger.warn('Receipt details block not found.');
                }
                if (extractedData.traReceiptDate && extractedData.traReceiptTime) {
                    try {
                        extractedData.traIssueDateTime = new Date(`${extractedData.traReceiptDate}T${extractedData.traReceiptTime}`);
                    }
                    catch (e) {
                        this.logger.warn(`Could not parse TRA date/time: ${extractedData.traReceiptDate} ${extractedData.traReceiptTime}`);
                    }
                }
                const items = [];
                const purchasedItemsRows = $('h3:contains("Purchased Items")').next().find('table.table-striped tbody tr');
                if (purchasedItemsRows.length > 0) {
                    purchasedItemsRows.each((i, row) => {
                        const description = this.cleanText($(row).find('td').eq(0).text());
                        const qtyString = this.cleanText($(row).find('td').eq(1).text());
                        const qty = qtyString ? parseInt(qtyString, 10) : 1;
                        const amount = this.parseAmount(this.cleanText($(row).find('td').eq(2).text()));
                        if (description) {
                            items.push({ description, quantity: qty || 1, amount });
                        }
                    });
                }
                else {
                    this.logger.warn('Purchased items table/rows not found.');
                }
                extractedData.items = items;
                const totalsTableRows = $('div.row div.col-xs-12 div.table table.table tbody tr');
                totalsTableRows.each((i, row) => {
                    const thText = this.cleanText($(row).find('th').text()).toUpperCase();
                    const tdAmount = this.parseAmount(this.cleanText($(row).find('td').text()));
                    if (thText.includes('TOTAL EXCL OF TAX'))
                        extractedData.totalExclTax = tdAmount;
                    if (thText.includes('TOTAL TAX'))
                        extractedData.totalTax = tdAmount;
                    if (thText.includes('TOTAL INCL OF TAX'))
                        extractedData.totalInclTax = tdAmount;
                });
                extractedData.receiptVerificationCode = this.cleanText($('div.invoice-header center h4').last().text());
                const isValid = !!extractedData.receiptVerificationCode;
                return {
                    isValid,
                    details: isValid ? `Successfully extracted TRA data. Verification Code: ${extractedData.receiptVerificationCode}` : 'Could not find TRA verification code or essential data.',
                    traData: extractedData,
                };
            }
            return { isValid: false, details: `TRA verification HTTP call returned status: ${response.status}` };
        }
        catch (error) {
            this.logger.error('Error fetching receipt data:', error);
            let details = 'Failed to fetch receipt data due to an error.';
            if (error instanceof axios_2.AxiosError && error.response) {
                details = `TRA API request failed with status ${error.response.status}. Data: ${JSON.stringify(error.response.data).substring(0, 200)}`;
                return { isValid: false, details, traData: { error: error.response.data } };
            }
            else if (error instanceof Error) {
                details = `TRA API request error: ${error.message}`;
            }
            return { isValid: false, details };
        }
    }
    async createAndVerifyReceipt(createReceiptDto) {
        const { verificationSecret } = createReceiptDto;
        const cookieJar = await this.fetchVerificationData('F51DA2329');
        if (!cookieJar) {
            throw new common_1.BadRequestException('Failed to fetch verification data from TRA.');
        }
        const receiptHtmlData = await this.fetchReceiptData(verificationSecret, cookieJar);
        if (!receiptHtmlData) {
            throw new common_1.BadRequestException('Failed to fetch receipt data from TRA.');
        }
        const extractedData = receiptHtmlData;
        if (!extractedData.isValid) {
            throw new common_1.BadRequestException(`TRA verification failed or no data extracted. Details: ${extractedData.details}`);
        }
        const traData = extractedData.traData;
        if (!traData.traReceiptNo) {
            throw new common_1.BadRequestException('Failed to extract TRA Receipt Number from verification data.');
        }
        if (!traData.traIssueDateTime) {
            throw new common_1.BadRequestException('Failed to extract TRA Issue Date/Time from verification data.');
        }
        if (traData.totalInclTax === undefined || traData.totalInclTax === null) {
            throw new common_1.BadRequestException('Failed to extract TRA Total Amount from verification data.');
        }
        if (!traData.customerName) {
            this.logger.warn(`Customer Name not found in TRA data for secret ${verificationSecret}. Using a placeholder or allowing empty if schema permits.`);
        }
        const receiptDataToInsert = {
            receiptNumber: traData.traReceiptNo,
            issueDate: traData.traIssueDateTime,
            totalAmount: traData.totalInclTax,
            items: traData.items || [],
            customerName: traData.customerName || 'N/A',
            isVerified: true,
            verificationDetails: extractedData.details,
            verifiedByTRAAt: new Date(),
        };
        const existingReceipt = await this.findOneByReceiptNumber(receiptDataToInsert.receiptNumber);
        if (existingReceipt) {
            this.logger.warn(`Receipt with TRA number ${receiptDataToInsert.receiptNumber} already exists (ID: ${existingReceipt.id}).`);
            throw new common_1.BadRequestException(`A receipt with TRA number ${receiptDataToInsert.receiptNumber} has already been recorded.`);
        }
        const newReceipts = await this.db
            .insert(schema.receiptsTable)
            .values(receiptDataToInsert)
            .returning();
        if (!newReceipts || newReceipts.length === 0) {
            this.logger.error('Failed to create receipt in database after TRA verification.');
            throw new Error('Failed to create receipt in database.');
        }
        return newReceipts[0];
    }
    async findAll() {
        return this.db.select().from(schema.receiptsTable);
    }
    async findOne(id) {
        const result = await this.db
            .select()
            .from(schema.receiptsTable)
            .where((0, drizzle_orm_1.eq)(schema.receiptsTable.id, id))
            .limit(1);
        return result[0];
    }
    async findOneByReceiptNumber(receiptNumber) {
        const result = await this.db
            .select()
            .from(schema.receiptsTable)
            .where((0, drizzle_orm_1.eq)(schema.receiptsTable.receiptNumber, receiptNumber))
            .limit(1);
        return result[0];
    }
    extractTextAfterB(element, label) {
        const text = element.find(`b:contains("${label}")`).parent().text();
        return this.cleanText(text.replace(label, ''));
        async;
        getReceiptById(id, number, user, { userId: number, role: string });
        {
            const receiptResult = await this.db.select().from(schema_1.receipts).where((0, drizzle_orm_1.eq)(schema_1.receipts.id, id)).limit(1);
            if (!receiptResult || receiptResult.length === 0) {
                return null;
            }
            const receipt = receiptResult[0];
            if (receipt.userId !== user.userId && user.role !== 'admin') {
                throw new common_2.ForbiddenException('You do not have permission to access this receipt.');
            }
            const purchasedItemsForReceipt = await this.db.select().from(schema_1.purchasedItems).where((0, drizzle_orm_1.eq)(schema_1.purchasedItems.receiptId, id));
            return { ...receipt, items: purchasedItemsForReceipt };
        }
        async;
        getReceiptsByUserId(userId, number);
        {
            const userReceipts = await this.db.select().from(schema_1.receipts).where((0, drizzle_orm_1.eq)(schema_1.receipts.userId, userId));
            if (!userReceipts || userReceipts.length === 0) {
                return [];
            }
            const receiptIds = userReceipts.map(r => r.id);
            const allItems = await this.db.select().from(schema_1.purchasedItems).where((0, drizzle_orm_2.inArray)(schema_1.purchasedItems.receiptId, receiptIds));
            return userReceipts.map(receipt => ({
                ...receipt,
                items: allItems.filter(item => item.receiptId === receipt.id)
            }));
        }
    }
    async generateReceiptPdf(receipt, items) {
        const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: sans-serif; margin: 40px; }
            h1 { text-align: center; color: #333; }
            .receipt-details { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
            .receipt-details td { border: 1px solid #ddd; padding: 8px; }
            .receipt-details td:first-child { font-weight: bold; width: 30%; }
            .items-table { border-collapse: collapse; width: 100%; }
            .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .items-table th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Tax Invoice</h1>
          <table class="receipt-details">
            <tr><td>Company Name:</td><td>${receipt.companyName}</td></tr>
            <tr><td>TIN:</td><td>${receipt.tin}</td></tr>
            <tr><td>Receipt No:</td><td>${receipt.receiptNo}</td></tr>
            <tr><td>Date:</td><td>${receipt.receiptDate}</td></tr>
            <tr><td>Total:</td><td>${receipt.totalInclTax}</td></tr>
          </table>
          <h2>Purchased Items</h2>
          <table class="items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                  <td>${item.amount}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
        if (!this.page) {
            throw new common_2.ServiceUnavailableException('Browser page is not available to generate PDF.');
        }
        await this.page.setContent(htmlContent, { waitUntil: 'networkidle' });
        const pdfBuffer = await this.page.pdf({ format: 'A4', printBackground: true });
        return pdfBuffer;
    }
    async generateReceiptPdf(receipt, items) {
        const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: sans-serif; margin: 40px; }
            h1 { text-align: center; color: #333; }
            .receipt-details { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
            .receipt-details td { border: 1px solid #ddd; padding: 8px; }
            .receipt-details td:first-child { font-weight: bold; width: 30%; }
            .items-table { border-collapse: collapse; width: 100%; }
            .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .items-table th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Tax Invoice</h1>
          <table class="receipt-details">
            <tr><td>Company Name:</td><td>${receipt.companyName}</td></tr>
            <tr><td>TIN:</td><td>${receipt.tin}</td></tr>
            <tr><td>Receipt No:</td><td>${receipt.receiptNo}</td></tr>
            <tr><td>Date:</td><td>${receipt.receiptDate}</td></tr>
            <tr><td>Total:</td><td>${receipt.totalInclTax}</td></tr>
          </table>
          <h2>Purchased Items</h2>
          <table class="items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                  <td>${item.amount}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
        if (!this.page) {
            throw new common_2.ServiceUnavailableException('Browser page is not available to generate PDF.');
        }
        await this.page.setContent(htmlContent, { waitUntil: 'networkidle' });
        const pdfBuffer = await this.page.pdf({ format: 'A4', printBackground: true });
        return pdfBuffer;
    }
};
exports.ReceiptsService = ReceiptsService;
exports.ReceiptsService = ReceiptsService = ReceiptsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(drizzle_provider_1.DRIZZLE_ORM_TOKEN)),
    __metadata("design:paramtypes", [typeof (_a = typeof node_postgres_1.NodePgDatabase !== "undefined" && node_postgres_1.NodePgDatabase) === "function" ? _a : Object, typeof (_b = typeof axios_1.HttpService !== "undefined" && axios_1.HttpService) === "function" ? _b : Object])
], ReceiptsService);
//# sourceMappingURL=receipts.service.js.map