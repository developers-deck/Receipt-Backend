import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import { DB_PROVIDER, DbService } from '../db/db.provider'; // Import DB_PROVIDER and DbService
import { receipts, NewReceipt, purchasedItems } from '../db/schema';
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
      await page.goto(`https://verify.tra.go.tz/${verificationCode}`, { timeout: 60000, waitUntil: 'domcontentloaded' });
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
      console.log('Extracted companyName:', companyName);

      // Get P.O. BOX directly from the b element
      const poBox = await page.$eval('div.invoice-info b', el => el.textContent?.trim());
      console.log('Extracted poBox:', poBox);
      
      const invoiceInfoElements = await page.$$('div.invoice-info b');
      const invoiceInfoTexts = await Promise.all(invoiceInfoElements.slice(1).map(async el => {
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

      // const customerInfoTexts = await page.$$eval('div.invoice-info p', elements => elements.map(el => el.textContent?.trim()));
      // console.log('Raw customerInfoTexts:', customerInfoTexts);
      // const customerName = customerInfoTexts[0]?.split(':')[1]?.trim();
      // const customerIdType = customerInfoTexts[1]?.split(':')[1]?.trim();
      // const customerId = customerInfoTexts[2]?.split(':')[1]?.trim();
      // const customerMobile = customerInfoTexts[3]?.split(':')[1]?.trim();

      // CUSTOMER INFO EXTRACTION
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
          
          // If this is the empty label row (SUMMARIZED SALE - E), use the Total Amount value
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
      // --- End Data Extraction ---

      // Save to database
      const newReceipt: NewReceipt = {
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
      // Use the injected drizzle instance
      try {
            const result = await this.db.insert(receipts).values(newReceipt).returning();
            console.log('Database insertion result:', result);

            if (result && result[0]) {
              const insertedReceipt = result[0];
              // Insert purchased items
              if (items && items.length > 0) {
                const purchasedItemsToInsert = items.map(item => ({
                  receiptId: insertedReceipt.id,
                  description: item.description,
                  quantity: item.qty,
                  amount: item.amount,
                }));
                await this.db.insert(purchasedItems).values(purchasedItemsToInsert);
                console.log(`Inserted ${items.length} purchased items.`);
              }
              return insertedReceipt;
            } else {
              console.error('Database insertion did not return a result.');
              return null;
            }
          } catch (dbError) {
            console.error('Database insertion error:', dbError);
            return null;
          }

      // await browser.close(); // Removed browser close

    } catch (error) {
      console.error('Error during scraping:', error);
      // await browser.close(); // Removed browser close
      return null;
    }
  }
}