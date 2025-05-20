import { Inject, Injectable, Logger, BadRequestException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../db/schema';
import { DRIZZLE_ORM_TOKEN } from '../db/drizzle.provider';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError, AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import { eq } from 'drizzle-orm'; // Import eq function
// Remove this line
// import { Element } from 'domhandler'; // Import Element from domhandler

// This DTO should ideally be in src/receipts/dto/create-receipt.dto.ts
export class CreateReceiptDto {
  verificationSecret: string; // The HH:MM:SS secret for TRA API
}

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);
  private readonly traBaseUrl = 'https://verify.tra.go.tz/Verify/Verified';
  private httpServiceWithCookies;

  constructor(
    @Inject(DRIZZLE_ORM_TOKEN) private db: NodePgDatabase<typeof schema>,
    private readonly httpService: HttpService,
  ) {
    this.httpServiceWithCookies = wrapper(this.httpService.axiosRef);
  }

  private cleanText(text: string | undefined | null): string {
    return text ? text.trim() : '';
  }

  private parseAmount(amountString: string): number {
    if (!amountString) return 0;
    return parseFloat(amountString.replace(/[^0-9.]/g, '')) || 0;
  }

  private async fetchVerificationData(verificationCode: string): Promise<CookieJar> {
    const url = `https://verify.tra.go.tz/${verificationCode}`;
    this.logger.log(`Fetching verification data from TRA with URL: ${url}`);

    const cookieJar = new CookieJar();

    try {
      const response: AxiosResponse<string> = await firstValueFrom(
        this.httpServiceWithCookies.get(url, { responseType: 'text', jar: cookieJar }),
      );

      this.logger.log(`Verification data response status: ${response.status}`);
      if (response.status === 200 && typeof response.data === 'string') {
        return cookieJar;
      }
    } catch (error) {
      this.logger.error('Error fetching verification data:', error);
    }
    return cookieJar; // Return an empty CookieJar instead of null
  }

  private async fetchReceiptData(verificationSecret: string, cookieJar: CookieJar): Promise<{ isValid: boolean; details?: string; traData?: any }> {
    const url = `https://verify.tra.go.tz/Verify/Verified?Secret=${encodeURIComponent(verificationSecret)}`;
    this.logger.log(`Fetching receipt data from TRA with URL: ${url}`);

    try {
      const response: AxiosResponse<string> = await firstValueFrom(
        this.httpServiceWithCookies.get(url, { responseType: 'text', jar: cookieJar }),
      );

      this.logger.log(`Receipt data response status: ${response.status}`);
      if (response.status === 200 && typeof response.data === 'string') {
        const htmlContent = response.data;
        this.logger.debug(`HTML Content: ${htmlContent}`);
        const $ = cheerio.load(htmlContent);
        const extractedData: Record<string, any> = {};

        // Company Name
        extractedData.supplierName = this.cleanText($('div.invoice-header center h4 b').first().text());

        // Supplier Info
        const supplierInfoBlock = $('div.invoice-info div.invoice-col');
        if (supplierInfoBlock.length > 0) {
          extractedData.supplierTin = this.extractTextAfterB(supplierInfoBlock, 'TIN:');
          extractedData.supplierVrn = this.extractTextAfterB(supplierInfoBlock, 'VRN:');
          extractedData.supplierSerialNo = this.extractTextAfterB(supplierInfoBlock, 'SERIAL NO:');
          extractedData.supplierUin = this.extractTextAfterB(supplierInfoBlock, 'UIN:');
          extractedData.supplierTaxOffice = this.extractTextAfterB(supplierInfoBlock, 'TAX OFFICE:');
          extractedData.supplierMobile = this.extractTextAfterB(supplierInfoBlock, 'MOBILE:');
          extractedData.supplierPoBox = this.extractTextAfterB(supplierInfoBlock, 'P.O BOX');
        } else {
          this.logger.warn('Supplier info block not found.');
        }

        // Customer Info
        const customerInfoBlock = $('div.invoice-header').next();
        if (customerInfoBlock.length > 0) {
          extractedData.customerName = this.extractTextAfterB(customerInfoBlock, 'CUSTOMER NAME:');
          extractedData.customerIdType = this.extractTextAfterB(customerInfoBlock, 'CUSTOMER ID TYPE:');
          extractedData.customerId = this.extractTextAfterB(customerInfoBlock, 'CUSTOMER ID:');
          extractedData.customerMobile = this.extractTextAfterB(customerInfoBlock, 'CUSTOMER MOBILE:');
        } else {
          this.logger.warn('Customer info block not found.');
        }

        // Receipt Details
        const receiptDetailsBlock = $('div.invoice-header').next().next();
        if (receiptDetailsBlock.length > 0) {
          extractedData.traReceiptNo = this.extractTextAfterB(receiptDetailsBlock, 'RECEIPT NO:');
          extractedData.traZNumber = this.extractTextAfterB(receiptDetailsBlock, 'Z NUMBER:');
          extractedData.traReceiptDate = this.extractTextAfterB(receiptDetailsBlock, 'RECEIPT DATE:');
          extractedData.traReceiptTime = this.extractTextAfterB(receiptDetailsBlock, 'RECEIPT TIME:');
        } else {
          this.logger.warn('Receipt details block not found.');
        }

        if (extractedData.traReceiptDate && extractedData.traReceiptTime) {
          try {
            extractedData.traIssueDateTime = new Date(`${extractedData.traReceiptDate}T${extractedData.traReceiptTime}`);
          } catch (e) {
            this.logger.warn(`Could not parse TRA date/time: ${extractedData.traReceiptDate} ${extractedData.traReceiptTime}`);
          }
        }

        // Purchased Items
        const items: any[] = [];
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
        } else {
          this.logger.warn('Purchased items table/rows not found.');
        }
        extractedData.items = items;

        // Totals
        const totalsTableRows = $('div.row div.col-xs-12 div.table table.table tbody tr');
        totalsTableRows.each((i, row) => {
          const thText = this.cleanText($(row).find('th').text()).toUpperCase();
          const tdAmount = this.parseAmount(this.cleanText($(row).find('td').text()));
          if (thText.includes('TOTAL EXCL OF TAX')) extractedData.totalExclTax = tdAmount;
          if (thText.includes('TOTAL TAX')) extractedData.totalTax = tdAmount;
          if (thText.includes('TOTAL INCL OF TAX')) extractedData.totalInclTax = tdAmount;
        });

        // Verification Code
        extractedData.receiptVerificationCode = this.cleanText($('div.invoice-header center h4').last().text());

        const isValid = !!extractedData.receiptVerificationCode;
        return {
          isValid,
          details: isValid ? `Successfully extracted TRA data. Verification Code: ${extractedData.receiptVerificationCode}` : 'Could not find TRA verification code or essential data.',
          traData: extractedData,
        };
      }
      return { isValid: false, details: `TRA verification HTTP call returned status: ${response.status}` };
    } catch (error) {
      this.logger.error('Error fetching receipt data:', error);
      let details = 'Failed to fetch receipt data due to an error.';
      if (error instanceof AxiosError && error.response) {
        details = `TRA API request failed with status ${error.response.status}. Data: ${JSON.stringify(error.response.data).substring(0, 200)}`;
        return { isValid: false, details, traData: { error: error.response.data } };
      } else if (error instanceof Error) {
        details = `TRA API request error: ${error.message}`;
      }
      return { isValid: false, details };
    }
  }

  async createAndVerifyReceipt(createReceiptDto: CreateReceiptDto): Promise<typeof schema.receiptsTable['$inferSelect']> {
    const { verificationSecret } = createReceiptDto;

    // Fetch verification data and save cookies
    const cookieJar = await this.fetchVerificationData('F51DA2329');
    if (!cookieJar) {
      throw new BadRequestException('Failed to fetch verification data from TRA.');
    }

    // Fetch receipt data using saved cookies
    const receiptHtmlData = await this.fetchReceiptData(verificationSecret, cookieJar);
    if (!receiptHtmlData) {
      throw new BadRequestException('Failed to fetch receipt data from TRA.');
    }

    // Process and validate data
    const extractedData = receiptHtmlData;
    if (!extractedData.isValid) {
      throw new BadRequestException(`TRA verification failed or no data extracted. Details: ${extractedData.details}`);
    }

    const traData = extractedData.traData;

    // Validate that critical data needed for DB insertion is present in traData
    if (!traData.traReceiptNo) {
      throw new BadRequestException('Failed to extract TRA Receipt Number from verification data.');
    }
    if (!traData.traIssueDateTime) { 
      throw new BadRequestException('Failed to extract TRA Issue Date/Time from verification data.');
    }
    if (traData.totalInclTax === undefined || traData.totalInclTax === null) { 
      throw new BadRequestException('Failed to extract TRA Total Amount from verification data.');
    }
    if (!traData.customerName) {
        this.logger.warn(`Customer Name not found in TRA data for secret ${verificationSecret}. Using a placeholder or allowing empty if schema permits.`);
    }

    const receiptDataToInsert: typeof schema.receiptsTable['$inferInsert'] = {
      receiptNumber: traData.traReceiptNo,
      issueDate: traData.traIssueDateTime,
      totalAmount: traData.totalInclTax,
      items: traData.items || [],
      customerName: traData.customerName || 'N/A',
      isVerified: true, 
      verificationDetails: extractedData.details,
      verifiedByTRAAt: new Date(),
    };

    // Check if a receipt with this TRA receipt number already exists
    const existingReceipt = await this.findOneByReceiptNumber(receiptDataToInsert.receiptNumber);
    if (existingReceipt) {
        this.logger.warn(`Receipt with TRA number ${receiptDataToInsert.receiptNumber} already exists (ID: ${existingReceipt.id}).`);
        throw new BadRequestException(`A receipt with TRA number ${receiptDataToInsert.receiptNumber} has already been recorded.`);
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

  // Implement missing methods
  async findAll(): Promise<typeof schema.receiptsTable['$inferSelect'][]> {
    return this.db.select().from(schema.receiptsTable);
  }

  async findOne(id: string): Promise<typeof schema.receiptsTable['$inferSelect'] | undefined> {
    const result = await this.db
      .select()
      .from(schema.receiptsTable)
      .where(eq(schema.receiptsTable.id, id))
      .limit(1);
    return result[0];
  }

  async findOneByReceiptNumber(receiptNumber: string): Promise<typeof schema.receiptsTable['$inferSelect'] | undefined> {
    const result = await this.db
      .select()
      .from(schema.receiptsTable)
      .where(eq(schema.receiptsTable.receiptNumber, receiptNumber))
      .limit(1);
    return result[0];
  }

  // Implement the missing extractTextAfterB method
  private extractTextAfterB(element: cheerio.Cheerio<any>, label: string): string {
    const text = element.find(`b:contains("${label}")`).parent().text();
    return this.cleanText(text.replace(label, ''));
  }
}