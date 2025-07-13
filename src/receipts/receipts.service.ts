import { Injectable, OnModuleInit, OnModuleDestroy, Inject, InternalServerErrorException, ServiceUnavailableException, NotFoundException, GatewayTimeoutException } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import { DB_PROVIDER } from '../db/db.provider';
import { receipts, NewReceipt, purchasedItems } from '../db/schema';
import { DbType } from '../db';
import { inArray, eq } from 'drizzle-orm';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ReceiptsService implements OnModuleInit, OnModuleDestroy {
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor(
    @Inject(DB_PROVIDER) private db: DbType,
    private configService: ConfigService,
  ) {} // Inject Drizzle ORM instance

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

  async getReceipt(verificationCode: string, receiptTime: string): Promise<NewReceipt> {
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

      if (items && items.length > 0) {
        const purchasedItemsToInsert = items.map(item => ({
          receiptId: insertedReceipt.id,
          description: item.description,
          quantity: item.qty,
          amount: item.amount,
        }));
        await this.db.insert(purchasedItems).values(purchasedItemsToInsert);
      }

      return insertedReceipt;

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