import { chromium, Browser, Page } from 'playwright';

export interface ScrapedReceiptData {
  companyName: string;
  poBox: string;
  mobile: string;
  details: Record<string, string>;
  items: Array<{ description: string; qty: string; amount: string }>;
  totalAmounts: Array<{ label: string; amount: string }>;
  receiptDate: string;
}

export class ScraperService {
  async scrapeReceipt(page: Page, verificationCode: string, receiptTime: string, traVerifyUrl: string): Promise<ScrapedReceiptData> {
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
      throw new Error('A receipt with the provided details could not be found.');
    }

    const companyName = await receiptContainer.$eval('.card-header h3', el => el.textContent?.trim() || '');
    const poBox = await receiptContainer.$eval('.card-header p:nth-of-type(1)', el => el.textContent?.trim() || '');
    const mobile = await receiptContainer.$eval('.card-header p:nth-of-type(2)', el => el.textContent?.trim() || '');

    const details = await receiptContainer.$$eval('.card-body .row .col-md-6', (cols) => {
      const data: Record<string, string> = {};
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

    return { companyName, poBox, mobile, details, items, totalAmounts, receiptDate };
  }
}