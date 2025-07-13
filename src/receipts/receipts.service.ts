import { Injectable, OnModuleInit, OnModuleDestroy, Inject, InternalServerErrorException, ServiceUnavailableException, NotFoundException, GatewayTimeoutException } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import { DB_PROVIDER } from '../db/db.provider';
import { receipts, NewReceipt, purchasedItems, Receipt } from '../db/schema';
import { DbType } from '../db';
import { inArray, eq } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';
import { FileUploadService } from '../file-upload/file-upload.service';
import * as QRCode from 'qrcode';

@Injectable()
export class ReceiptsService implements OnModuleInit, OnModuleDestroy {
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor(
    @Inject(DB_PROVIDER) private db: DbType,
    private configService: ConfigService,
    private fileUploadService: FileUploadService,
  ) {} // Inject FileUploadService

  async onModuleInit() {
    await this.initializeBrowser();
  }

  private async initializeBrowser() {
    try {
      if (this.browser) {
        console.log('Closing existing Playwright browser instance.');
        await this.browser.close();
        this.browser = null;
        this.page = null;
      }
      
      console.log('Attempting to launch Playwright browser...');
      this.browser = await chromium.launch({
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
    } catch (error) {
      console.error('Failed to initialize Playwright:', error);
      if (this.page) {
        try {
          await this.page.close();
        } catch (closePageError) {
          console.error('Error closing page during cleanup:', closePageError);
        }
        this.page = null;
      }
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (closeBrowserError) {
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

  async getReceiptsByUserId(userId: number) {
    const userReceipts = await this.db.select().from(receipts).where(eq(receipts.userId, userId));
    if (!userReceipts || userReceipts.length === 0) {
      return [];
    }
    const receiptIds = userReceipts.map(r => r.id);
    const allItems = receiptIds.length > 0
      ? await this.db.select().from(purchasedItems).where(inArray(purchasedItems.receiptId, receiptIds))
      : [];
    return userReceipts.map(receipt => ({
      ...receipt,
      items: allItems.filter(item => item.receiptId === receipt.id)
    }));
  }

  async getAllReceipts() {
    const allReceipts = await this.db.select().from(receipts);
    const receiptIds = allReceipts.map(r => r.id);
    const allItems = receiptIds.length > 0
      ? await this.db.select().from(purchasedItems).where(inArray(purchasedItems.receiptId, receiptIds))
      : [];
    return allReceipts.map(receipt => ({
      ...receipt,
      items: allItems.filter(item => item.receiptId === receipt.id)
    }));
  }

  async getReceipt(verificationCode: string, receiptTime: string, userId: number): Promise<Receipt> {
    if (!this.page) {
      console.log('Playwright page not initialized. Attempting to reinitialize...');
      await this.initializeBrowser();
      
      if (!this.page) {
        console.error('Failed to initialize Playwright page after retry.');
        throw new ServiceUnavailableException('Failed to initialize browser service.');
      }
    }
    const page = this.page;

    try {
      // Navigate to the verification page
      const traVerifyUrl = this.configService.get<string>('TRA_VERIFY_URL');
      await page.goto(`${traVerifyUrl}/${verificationCode}`, { timeout: 60000, waitUntil: 'domcontentloaded' });

      // Check if the page asks for time and submit if needed
      const hourSelect = await page.$('#HH');
      if (hourSelect) {
        const [hour, minute] = receiptTime.split(':');
        await hourSelect.selectOption(hour);
        await page.selectOption('#MM', minute);
        // Assuming seconds are not always required or available
        if ((await page.$('#SS')) && receiptTime.split(':').length > 2) {
            await page.selectOption('#SS', receiptTime.split(':')[2]);
        }
        const submitButtonSelector = 'button[type="submit"]';
        await page.waitForSelector(submitButtonSelector, { state: 'visible', timeout: 60000 });
        await page.click(submitButtonSelector, { timeout: 60000 });
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 });
      }

      // Verify that the receipt content is present before scraping
      const receiptContainer = await page.$('.receipt-container');
      if (!receiptContainer) {
        throw new NotFoundException('A receipt with the provided details could not be found.');
      }

      // Scrape receipt data
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

      const items = await receiptContainer.$$eval('table.table-condensed tbody tr', rows =>
        rows.map(row => {
          const cols = row.querySelectorAll('td');
          return {
            description: (cols[0]?.textContent || '').trim(),
            qty: (cols[1]?.textContent || '').trim(),
            amount: (cols[2]?.textContent || '').trim(),
          };
        }),
      );

      const totalAmounts = await receiptContainer.$$eval('table.table.mt-5 tbody tr', rows =>
        rows.map(row => {
          const label = (row.querySelector('td:first-child')?.textContent || '').trim();
          const amount = (row.querySelector('td:last-child')?.textContent || '').trim();
          return { label, amount };
        }),
      );

      const receiptDateTime = details['Date & Time:'] || '';
      const [receiptDate] = receiptDateTime.split(' ');

      // Save to database
      const newReceipt: NewReceipt = {
        userId,
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
        verificationCodeUrl: `${this.configService.get<string>('TRA_VERIFY_URL')}/${verificationCode}`,
      };

      const result = await this.db.insert(receipts).values(newReceipt).returning();
      const insertedReceipt = result[0];

      if (!insertedReceipt) {
        throw new InternalServerErrorException('Failed to save receipt to the database.');
      }

      const fullReceiptData = { 
        ...insertedReceipt, 
        items: items.map(item => ({ ...item, qty: parseFloat(item.qty), amount: parseFloat(item.amount) })) 
      };

      // Generate PDF
      const pdfBuffer = await this.generateReceiptPdf(fullReceiptData);

      // Upload PDF to Backblaze B2
      const pdfUrl = await this.fileUploadService.upload(pdfBuffer, 'application/pdf');

      // Update receipt with PDF URL
      const updatedResult = await this.db.update(receipts)
        .set({ pdfUrl })
        .where(eq(receipts.id, insertedReceipt.id))
        .returning();

      if (items && items.length > 0) {
        const purchasedItemsToInsert = items.map(item => ({
          receiptId: insertedReceipt.id,
          description: item.description,
          quantity: item.qty,
          amount: item.amount,
        }));
        await this.db.insert(purchasedItems).values(purchasedItemsToInsert);
      }

      return updatedResult[0];

    } catch (error) {
      console.error(`Error during scraping for ${verificationCode}:`, error);

      if (error.name === 'TimeoutError') {
        throw new GatewayTimeoutException('The verification took too long to respond. Please try again later.');
      }

      if (error instanceof NotFoundException || error instanceof InternalServerErrorException || error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new ServiceUnavailableException('An unexpected error occurred while getting the receipt data.');
    }
  }

  async getReceiptById(id: number) {
    const receipt = await this.db.select().from(receipts).where(eq(receipts.id, id)).limit(1);
    if (!receipt || receipt.length === 0) {
      return null;
    }
    const purchasedItemsForReceipt = await this.db.select().from(purchasedItems).where(eq(purchasedItems.receiptId, id));
    return { ...receipt[0], items: purchasedItemsForReceipt };
  }

  private async generateReceiptPdf(receiptData: any): Promise<Buffer> {
    const traLogoUrl = 'https://f004.backblazeb2.com/file/receipts-tanzania/tralogoss.png'; // Replace with actual TRA logo URL
    // Generate QR code as a data URL for the verification URL
    const qrCodeDataUrl = await QRCode.toDataURL(receiptData.verificationCodeUrl || '');
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Legal Receipt</title>
          <!-- Gentelella font import (using Nunito Sans as a close match if Gentelella is not available on Google Fonts) -->
          <link href="https://fonts.googleapis.com/css?family=Nunito+Sans:400,700&display=swap" rel="stylesheet">
          <style>
              body { font-family: 'Helvetica Neue', 'Nunito Sans', Arial, Helvetica, sans-serif; background: #fafbfc; color: #222; }
              .receipt-container { max-width: 900px; margin: 20px auto; background: #fff; border: 1px solid #eee; padding: 30px 40px; box-shadow: 0 0 10px rgba(0,0,0,0.05); }
              .header, .footer { text-align: center; font-weight: bold; color: #888; margin-bottom: 10px; }
              .logo { display: block; margin: 0 auto 10px auto; height: 60px; }
              .divider { border-top: 1px dotted #bbb; margin: 20px 0; }
              .company-info { text-align: center; font-size: 1.1em; color: #234; margin-bottom: 10px; }
              .company-info strong { font-size: 1.2em; color: #234; }
              .details-table, .items-table, .totals-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
              .details-table td { padding: 2px 6px; font-size: 0.98em; }
              .items-table th, .items-table td { border: 1px solid #e0e0e0; padding: 8px; text-align: left; }
              .items-table th { background: #f5f5f5; font-weight: bold; }
              .items-table td:last-child, .items-table th:last-child { text-align: right; }
              .items-table td:nth-child(2) { text-align: center; }
              .totals-table td { padding: 6px; font-size: 1em; border: 1px solid #e0e0e0; }
              .totals-table tr:not(:last-child) td { background: #fafbfc; }
              .totals-table tr:last-child td { font-weight: bold; background: #f5f5f5; }
              .section-title { font-size: 1.1em; font-weight: bold; margin: 18px 0 8px 0; color: #234; }
              .qr-section { text-align: center; margin: 20px 0 10px 0; }
              .qr-section img { height: 90px; margin-bottom: 8px; }
              .verification-code { text-align: center; font-size: 1.1em; font-weight: bold; margin: 10px 0; }
              .print-btn { display: inline-block; background: #ffe600; color: #222; border: none; padding: 8px 18px; font-size: 1em; border-radius: 4px; margin: 18px auto 0 auto; cursor: pointer; font-weight: bold; }
          </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="header">*** START OF LEGAL RECEIPT ***</div>
          <img src="${traLogoUrl}" alt="TRA Logo" class="logo" />
          <div class="divider"></div>
          <div class="company-info">
            <strong>${receiptData.companyName || ''}</strong><br/>
            ${receiptData.poBox ? `P.O BOX ${receiptData.poBox}` : ''} ${receiptData.mobile ? `<br/>MOBILE: ${receiptData.mobile}` : ''}<br/>
            TIN: ${receiptData.tin || ''}<br/>
            VRN: ${receiptData.vrn || ''}<br/>
            ${receiptData.serialNo ? `SERIAL NO: ${receiptData.serialNo}<br/>` : ''}
            ${receiptData.uin ? `UIN: ${receiptData.uin}<br/>` : ''}
            ${receiptData.taxOffice ? `TAX OFFICE: ${receiptData.taxOffice}` : ''}
          </div>
          <div class="divider"></div>
          <table class="details-table">
            <tr><td><b>CUSTOMER NAME:</b> ${receiptData.customerName || ''}</td><td><b>CUSTOMER ID TYPE:</b> ${receiptData.customerIdType || ''}</td></tr>
            <tr><td><b>CUSTOMER ID:</b> ${receiptData.customerId || ''}</td><td><b>CUSTOMER MOBILE:</b> ${receiptData.customerMobile || ''}</td></tr>
            <tr><td><b>RECEIPT NO:</b> ${receiptData.receiptNo || ''}</td><td><b>Z NUMBER:</b> ${receiptData.zNumber || ''}</td></tr>
            <tr><td><b>RECEIPT DATE:</b> ${receiptData.receiptDate || ''}</td><td><b>RECEIPT TIME:</b> ${receiptData.receiptTime || ''}</td></tr>
          </table>
          <div class="divider"></div>
          <div class="section-title">Purchased Items</div>
          <table class="items-table">
            <thead>
              <tr><th>Description</th><th>Qty</th><th>Amount</th></tr>
            </thead>
            <tbody>
              ${receiptData.items.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.qty}</td>
                  <td>${Number(item.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <table class="totals-table">
            <tr><td>TOTAL EXCL OF TAX:</td><td>${receiptData.totalExclTax || ''}</td></tr>
            <tr><td>TAX RATE A (18%):</td><td>${receiptData.totalTax || ''}</td></tr>
            <tr><td>TOTAL TAX:</td><td>${receiptData.totalTax || ''}</td></tr>
            <tr><td>TOTAL INCL OF TAX:</td><td>${receiptData.totalInclTax || ''}</td></tr>
          </table>
          <div class="divider"></div>
          <div class="verification-code">RECEIPT VERIFICATION CODE<br/>${receiptData.verificationCode || ''}</div>
          <div class="qr-section">
            <img src="${qrCodeDataUrl}" alt="QR Code" />
          </div>
          <div class="divider"></div>
          <div class="footer">*** END OF LEGAL RECEIPT ***</div>
          <div style="text-align:center;">
            <span class="print-btn">Print Receipt</span>
          </div>
        </div>
      </body>
      </html>
    `;
    if (!this.page) {
      throw new ServiceUnavailableException('Browser page is not available for PDF generation.');
    }
    await this.page.setContent(htmlContent, { waitUntil: 'networkidle' });
    const pdfBuffer = await this.page.pdf({ format: 'A4', printBackground: true });
    return pdfBuffer;
  }

  async getReceiptsByCompanyName(companyName: string) {
    const matchingReceipts = await this.db.select().from(receipts).where(eq(receipts.companyName, companyName));
    if (!matchingReceipts || matchingReceipts.length === 0) {
      return [];
    }
    const receiptIds = matchingReceipts.map(r => r.id);
    const allItems = receiptIds.length > 0
      ? await this.db.select().from(purchasedItems).where(inArray(purchasedItems.receiptId, receiptIds))
      : [];
    return matchingReceipts.map(receipt => ({
      ...receipt,
      items: allItems.filter(item => item.receiptId === receipt.id)
    }));
  }
}