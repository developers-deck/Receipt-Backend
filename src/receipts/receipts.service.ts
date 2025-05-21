import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import { DB_PROVIDER, DbService } from '../db/db.provider'; // Import DB_PROVIDER and DbService
import { receipts, NewReceipt } from '../db/schema';
import { DbType } from '../db';

@Injectable()
export class ReceiptsService implements OnModuleInit, OnModuleDestroy {
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor(@Inject(DB_PROVIDER) private db: DbType) {} // Inject Drizzle ORM instance

  async onModuleInit() {
    this.browser = await chromium.launch();
    this.page = await this.browser.newPage();
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async getReceipt(verificationCode: string, receiptTime: string): Promise<NewReceipt | null> {
    if (!this.page) {
      console.error('Playwright page not initialized.');
      return null;
    }
    const page = this.page;

    try {
      // Navigate to the verification page
      await page.goto(`https://verify.tra.go.tz/${verificationCode}`);
      console.log(`Navigated to https://verify.tra.go.tz/${verificationCode}`);
      console.log('Page title:', await page.title());

      // Check if the page asks for time (indicating the first step was successful)
      // Assuming the presence of hour, minute, and second dropdowns indicates the time step
      const hourSelect = await page.$('#HH');
      const minuteSelect = await page.$('#MM');
      const secondSelect = await page.$('#SS');

      if (!hourSelect || !minuteSelect || !secondSelect) {
        console.error('Verification code not found or invalid, or time inputs not found.');
        // await browser.close(); // Removed browser close
      return null;
    }

      // Assuming receiptTime is in HH:MM:SS format
      const [hour, minute, second] = receiptTime.split(':');

      // Fill the time and submit
      await hourSelect.selectOption(hour);
      await minuteSelect.selectOption(minute);
      await secondSelect.selectOption(second);
      console.log(`Selected time: ${hour}:${minute}:${second}`);

      // Click the submit button
      // Click the submit button and wait for navigation
      // Click the submit button
      await page.click('button[onclick="validateSecret()"]');
      // Wait for an element on the next page to appear, indicating successful navigation
      await page.waitForSelector('div.invoice-header center h4 b', { timeout: 30000 }); // Increased timeout for robustness
      console.log('Clicked submit button and waiting for navigation.');
      console.log('Current URL after navigation:', page.url());
      const pageContent = await page.content();
      console.log('Page Content after navigation:', pageContent);


      // --- Data Extraction ---
      // Updated data extraction logic based on the final page structure.
      // --- Data Extraction ---
      // Updated data extraction logic based on the final page structure.
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
      // --- End Data Extraction ---

      // Save to database
      const newReceipt: NewReceipt = {
        verificationCode,
        receiptTime,
        receiptData,
      };
      // Use the injected drizzle instance
      const result = await this.db.insert(receipts).values(newReceipt).returning();

      // await browser.close(); // Removed browser close
      return result[0];

    } catch (error) {
      console.error('Error during scraping:', error);
      // await browser.close(); // Removed browser close
      return null;
    }
  }
}