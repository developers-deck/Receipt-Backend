import { Injectable, OnModuleInit, OnModuleDestroy, Inject, InternalServerErrorException, ServiceUnavailableException, NotFoundException, GatewayTimeoutException } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import { DB_PROVIDER } from '../db/db.provider';
import { receipts, NewReceipt, purchasedItems, Receipt } from '../db/schema';
import { DbType } from '../db';
import { inArray, eq } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';
import { FileUploadService } from '../file-upload/file-upload.service';
import * as QRCode from 'qrcode';
import { Mutex } from 'async-mutex';
import { PdfGeneratorService } from './pdf-generator.service';
import { ScraperService, ScrapedReceiptData } from './scraper.service';
import { PdfQueueService } from './pdf-queue.service';

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
  private page: Page | null = null;
  private browserInitLock = new Mutex();
  private pdfGenerator = new PdfGeneratorService();
  private scraper = new ScraperService();
  private pdfQueue = new PdfQueueService();

  constructor(
    @Inject(DB_PROVIDER) private db: DbType,
    private configService: ConfigService,
    private fileUploadService: FileUploadService,
  ) {} // Inject FileUploadService

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
        await safeClosePage(this.page);
        this.page = null;
        await safeCloseBrowser(this.browser);
        this.browser = null;
        throw error;
      }
    });
  }

  async onModuleDestroy() {
    await safeCloseBrowser(this.browser);
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
    // Group items by receiptId for O(1) lookup
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
    const receiptIds = allReceipts.map(r => r.id);
    const allItems = receiptIds.length > 0
      ? await this.db.select().from(purchasedItems).where(inArray(purchasedItems.receiptId, receiptIds))
      : [];
    // Group items by receiptId for O(1) lookup
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

  async getReceipt(verificationCode: string, receiptTime: string, userId: number): Promise<any> {
    const traVerifyUrl = this.configService.get<string>('TRA_VERIFY_URL') || '';
    let scraped: ScrapedReceiptData;
    try {
      scraped = await this.scraper.scrapeReceipt(verificationCode, receiptTime, traVerifyUrl);
    } finally {
      await this.scraper.close();
    }
    // Save to database
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
    // Enqueue PDF generation/upload job
    await this.pdfQueue.enqueueJob({ receiptId: insertedReceipt.id, receiptData: { ...insertedReceipt, items: scraped.items } });
    return { status: 'queued', receiptId: insertedReceipt.id };
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
    // Use PdfGeneratorService to get HTML with embedded QR code
    const htmlContent = await this.pdfGenerator.generateReceiptPdf(receiptData).catch((err) => {
      throw new InternalServerErrorException('Failed to generate receipt HTML: ' + err.message);
    });
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
    // Group items by receiptId for O(1) lookup
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