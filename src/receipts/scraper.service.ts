import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Page } from 'playwright';

export interface ScrapedReceiptData {
  companyName: string;
  poBox: string;
  mobile: string;
  details: Record<string, string>;
  items: Array<{ description: string; qty: string; amount: string }>;
  totalAmounts: Array<{ label: string; amount: string }>;
  receiptDate: string;
  receiptTime: string;
  verificationUrl?: string;
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  async scrapeReceipt(
    page: Page,
    verificationCode: string,
    receiptTime: string,
    traVerifyUrl: string,
  ): Promise<ScrapedReceiptData & { verificationUrl: string }> {
    this.logger.log(`Starting to scrape receipt for code: ${verificationCode}`);
    try {
      const url = `${traVerifyUrl}/${verificationCode}`;
      await page.goto(url, { timeout: 60000, waitUntil: 'domcontentloaded' });
      this.logger.log(`Navigated to ${url}`);

      // The page asks for time, so we need to provide it.
      const hourSelector = 'select#HH';
      const minuteSelector = 'select#MM';
      const secondSelector = 'select#SS';
      const submitButtonSelector = 'button[onclick="validateSecret()"]';

      await page.waitForSelector(hourSelector, { timeout: 30000 });
      this.logger.log('Time input selectors are visible.');

      const [hour, minute, second] = receiptTime.split(':');
      if (!hour || !minute || !second) {
        throw new Error('Invalid receiptTime format. Expected HH:MM:SS');
      }

      await page.selectOption(hourSelector, hour);
      await page.selectOption(minuteSelector, minute);
      await page.selectOption(secondSelector, second);
      this.logger.log(`Time ${receiptTime} entered successfully.`);

      await page.waitForSelector(submitButtonSelector, { timeout: 10000 });
      this.logger.log('Submit button is visible. Clicking and waiting for navigation...');

      // Use Promise.all to avoid a race condition where navigation finishes before we start waiting.
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }),
        page.click(submitButtonSelector),
      ]);
      this.logger.log('Navigated to receipt details page.');

      const scrapedData = await this.extractReceiptData(page);
      this.logger.log(`Successfully scraped receipt for code: ${verificationCode}`);
      
      // Add the verification URL to the scraped data
      return {
        ...scrapedData,
        verificationUrl: url
      };
    } catch (error) {
      this.logger.error(
        `Error scraping receipt for code ${verificationCode}: ${error.message}`,
        error.stack,
      );
      await this.logPageError(page, verificationCode);
      throw new InternalServerErrorException(
        `Failed to scrape receipt: ${error.message}`,
      );
    }
  }

  private async extractReceiptData(page: Page): Promise<ScrapedReceiptData> {
    return page.evaluate(() => {
      const getText = (selector: string) => document.querySelector(selector)?.textContent?.trim() || '';

      // Combine text from all relevant sections to ensure all data is captured
      const allTextContent = Array.from(document.querySelectorAll('.invoice-header, .invoice-col, address'))
        .map(el => (el as HTMLElement).innerText)
        .join('\n');

      // Improved regex to handle labels and values more reliably
      const extractValue = (label: string) => {
        const regex = new RegExp(`(?:${label.replace(':', '')}:)\s*([^\n]+)`, 'i');
        const match = allTextContent.match(regex);
        return match ? match[1].trim() : '';
      };

      const companyName = getText('.invoice-header center h4 b');
      const poBox = extractValue('P.O BOX');
      const mobile = extractValue('MOBILE');
      const receiptDate = extractValue('RECEIPT DATE');
      const receiptTime = extractValue('TIME');

      const details = {
        'TIN:': extractValue('TIN'),
        'VRN:': extractValue('VRN'),
        'Serial No:': extractValue('SERIAL NO'),
        'UIN:': extractValue('UIN'),
        'Tax Office:': extractValue('TAX OFFICE'),
        'Customer Name:': extractValue('CUSTOMER NAME'),
        'Customer ID Type:': extractValue('CUSTOMER ID TYPE'),
        'Customer ID:': extractValue('CUSTOMER ID'),
        'Customer Mobile:': extractValue('CUSTOMER MOBILE'),
        'Receipt No:': extractValue('RECEIPT NO'),
        'Z-Number:': extractValue('Z NUMBER'),
        'Receipt Date:': receiptDate,
        'Receipt Time:': receiptTime,
      };

      const items = Array.from(
        document.querySelectorAll('table.table-striped tbody tr'),
      ).map((row) => {
        const cols = row.querySelectorAll('td');
        return {
          description: cols[0]?.textContent?.trim() || '',
          qty: cols[1]?.textContent?.trim() || '0',
          amount: cols[2]?.textContent?.trim() || '',
        };
      });

      const totalAmounts = Array.from(
        document.querySelectorAll('div.table > table tbody tr'),
      ).map((row) => {
        const cols = row.querySelectorAll('th, td');
        return {
          label: cols[0]?.textContent?.trim() || '',
          amount: cols[1]?.textContent?.trim() || '',
        };
      });

      return {
        companyName,
        poBox,
        mobile,
        details,
        receiptDate,
        receiptTime,
        items,
        totalAmounts,
      };
    });
  }

  private async logPageError(page: Page, verificationCode: string) {
    try {
      const pageContent = await page.content();
      this.logger.error(
        `Page content for ${verificationCode} on error:\n${pageContent}`,
      );
      // Screenshots are disabled in the final version to save space/resources,
      // but can be enabled for debugging.
      /*
      const screenshotBuffer = await page.screenshot({ fullPage: true });
      // fs.writeFileSync(`error-${verificationCode}-${Date.now()}.png`, screenshotBuffer);
      this.logger.error(`Screenshot taken for ${verificationCode}.`);
      */
    } catch (logError) {
      this.logger.error(
        `Could not get page content or screenshot for ${verificationCode}:`,
        logError.stack,
      );
    }
  }
}