import { Injectable, OnModuleInit, OnModuleDestroy, Inject, InternalServerErrorException, ServiceUnavailableException, NotFoundException, GatewayTimeoutException } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import { DB_PROVIDER } from '../db/db.provider';
import { receipts, NewReceipt, purchasedItems, Receipt } from '../db/schema';
import { inArray, eq } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';
import { FileUploadService } from '../file-upload/file-upload.service';
import * as QRCode from 'qrcode';
import { Mutex } from 'async-mutex';
import { PdfGeneratorService } from './pdf-generator.service';
import { ScraperService, ScrapedReceiptData } from './scraper.service';
import { PdfQueueService } from './pdf-queue.service';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';

// Define the database type
type DbType = ReturnType<typeof drizzle<typeof schema>>;

function safeClosePage(page: Page | null) {
  if (page) {
    return page.close().catch((err) => {
      console.error('Error closing page during cleanup:', err);
    });
  }
  return Promise.resolve();
}

function safeCloseBrowser(browser: Browser | null) {
  if (browser) {
    return browser.close().catch((err) => {
      console.error('Error closing browser during cleanup:', err);
    });
  }
  return Promise.resolve();
}

@Injectable()
export class ReceiptsService implements OnModuleInit, OnModuleDestroy {
  private browser: Browser | null = null;
  private browserInitLock = new Mutex();

  constructor(
    @Inject(DB_PROVIDER) private db: DbType,
    private configService: ConfigService,
    private fileUploadService: FileUploadService,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly scraper: ScraperService,
    private readonly pdfQueue: PdfQueueService,
  ) {}

  async onModuleInit() {
    await this.initializeBrowser();
  }

  private async initializeBrowser() {
    return this.browserInitLock.runExclusive(async () => {
      try {
        if (this.browser) {
          console.log('Closing existing Playwright browser instance.');
          await safeCloseBrowser(this.browser);
          this.browser = null;
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
        console.log('Playwright browser launched successfully.');
      } catch (error) {
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

  async getReceiptsByUserId(userId: string) {
    const userReceipts = await this.db.select().from(receipts).where(eq(receipts.userId, userId));
    if (!userReceipts || userReceipts.length === 0) {
      return [];
    }
    const receiptIds = userReceipts.map(r => r.id);
    const allItems = receiptIds.length > 0
      ? await this.db.select().from(purchasedItems).where(inArray(purchasedItems.receiptId, receiptIds))
      : [];
    const itemsByReceipt = new Map();
    allItems.forEach(item => {
      if (!itemsByReceipt.has(item.receiptId)) itemsByReceipt.set(item.receiptId, []);
      itemsByReceipt.get(item.receiptId).push(item);
    });
    return userReceipts.map(receipt => ({
      ...receipt,
      items: itemsByReceipt.get(receipt.id) || []
    }));
  }

  async getAllReceipts() {
    const allReceipts = await this.db.select().from(receipts);
    if (!allReceipts || allReceipts.length === 0) {
      return [];
    }
    const receiptIds = allReceipts.map(r => r.id);
    const allItems = receiptIds.length > 0
      ? await this.db.select().from(purchasedItems).where(inArray(purchasedItems.receiptId, receiptIds))
      : [];
    const itemsByReceipt = new Map();
    allItems.forEach(item => {
      if (!itemsByReceipt.has(item.receiptId)) itemsByReceipt.set(item.receiptId, []);
      itemsByReceipt.get(item.receiptId).push(item);
    });
    return allReceipts.map(receipt => ({
      ...receipt,
      items: itemsByReceipt.get(receipt.id) || []
    }));
  }

  async getReceipt(verificationCode: string, receiptTime: string, userId: string): Promise<any> {
    if (!this.browser || !this.browser.isConnected()) {
      console.log('Browser is not connected. Re-initializing...');
      await this.initializeBrowser();
      if (!this.browser) {
        throw new ServiceUnavailableException('Failed to initialize browser after re-attempt.');
      }
    }

    let page: Page | null = null;
    try {
      // First check if browser is connected, and re-initialize if not.
      if (!this.browser || !this.browser.isConnected()) {
        console.log('Browser is not connected. Re-initializing...');
        await this.initializeBrowser();
        if (!this.browser) {
          throw new ServiceUnavailableException('Failed to initialize browser after re-attempt.');
        }
      }

      try {
        // Attempt to create a new page
        page = await this.browser.newPage();
      } catch (error) {
        // If it fails, it's likely the browser disconnected just now. Re-initialize and retry once.
        console.error('Failed to create new page, browser might have disconnected. Retrying...', error);
        await this.initializeBrowser();
        if (!this.browser) {
          throw new ServiceUnavailableException('Failed to re-initialize browser for retry.');
        }
        page = await this.browser.newPage();
      }
      const traVerifyUrl = this.configService.get<string>('TRA_VERIFY_URL') || '';
      const scraped = await this.scraper.scrapeReceipt(page, verificationCode, receiptTime, traVerifyUrl);

      const newReceipt: NewReceipt = {
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

      const result = await this.db.insert(receipts).values(newReceipt).returning();
      const insertedReceipt = result[0];

      if (!insertedReceipt) {
        throw new InternalServerErrorException('Failed to save receipt to the database.');
      }

      if (scraped.items && scraped.items.length > 0) {
        const purchasedItemsToInsert = scraped.items.map(item => ({
          receiptId: insertedReceipt.id,
          description: item.description,
          quantity: item.qty,
          amount: item.amount,
        }));
        if (purchasedItemsToInsert.length > 0) {
          await this.db.insert(purchasedItems).values(purchasedItemsToInsert);
        }
      }

      const fullReceiptDataForPdf = {
        ...insertedReceipt,
        ...scraped.details, // Spread all the details for the PDF
        items: scraped.items,
        totalAmounts: scraped.totalAmounts,
      };

      await this.pdfQueue.enqueueJob({ receiptId: insertedReceipt.id, receiptData: fullReceiptDataForPdf });
      return { status: 'queued', receiptId: insertedReceipt.id };
    } finally {
      if (page) {
        await safeClosePage(page);
      }
    }
  }

  async getReceiptById(id: string) {
    const receiptId = parseInt(id, 10);
    if (isNaN(receiptId)) {
      return null;
    }
    const receipt = await this.db.select().from(receipts).where(eq(receipts.id, receiptId)).limit(1);
    if (!receipt || receipt.length === 0) {
      return null;
    }
    const purchasedItemsForReceipt = await this.db.select().from(purchasedItems).where(eq(purchasedItems.receiptId, receiptId));
    return { ...receipt[0], items: purchasedItemsForReceipt };
  }

  async generateReceiptPdf(receiptData: any): Promise<Buffer> {
    if (!this.browser) {
      throw new ServiceUnavailableException('Browser is not initialized for PDF generation.');
    }
    const page = await this.browser.newPage();
    try {
      const htmlContent = await this.pdfGenerator.generateReceiptPdf(receiptData);
      await page.setContent(htmlContent, { waitUntil: 'networkidle' });
      return await page.pdf({ format: 'A4', printBackground: true });
    } finally {
      await safeClosePage(page);
    }
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
    const itemsByReceipt = new Map();
    allItems.forEach(item => {
      if (!itemsByReceipt.has(item.receiptId)) itemsByReceipt.set(item.receiptId, []);
      itemsByReceipt.get(item.receiptId).push(item);
    });
    return matchingReceipts.map(receipt => ({
      ...receipt,
      items: itemsByReceipt.get(receipt.id) || []
    }));
  }
}