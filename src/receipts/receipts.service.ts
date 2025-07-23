import { Injectable, Inject, NotFoundException, UnauthorizedException, ConflictException, InternalServerErrorException, ServiceUnavailableException, Logger } from '@nestjs/common';
import { GetReceiptDto } from './dto/get-receipt.dto';
import { and, desc, eq, ilike, sql, SQL } from 'drizzle-orm';
import { User, receipts, purchasedItems, NewReceipt } from '../db/schema';
import { DB_PROVIDER, DbType } from '../db/db.provider';
import { ScraperService } from './scraper.service';
import { PdfQueueService } from './pdf-queue.service';
import * as crypto from 'crypto';
import { FileUploadService } from '../file-upload/file-upload.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { PlaywrightService } from '../playwright/playwright.service';

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);
  constructor(
    @Inject(DB_PROVIDER) private db: DbType,
    private readonly scraper: ScraperService,
    private readonly pdfQueue: PdfQueueService,
    private readonly fileUploadService: FileUploadService,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly playwrightService: PlaywrightService,
  ) { }

  // 1. Create a new receipt (scrape and save)
  /**
   * Create a new receipt by scraping data and saving to database
   */
  async createReceipt(getReceiptDto: GetReceiptDto, userId: string) {
    const browser = await this.playwrightService.getBrowser();
    const page = await browser.newPage();
    let scraped;
    try {
      const traVerifyUrl = process.env.TRA_VERIFY_URL;
      if (!traVerifyUrl) {
        throw new Error('TRA_VERIFY_URL environment variable is not set.');
      }
      scraped = await this.scraper.scrapeReceipt(page, getReceiptDto.verificationCode, getReceiptDto.receiptTime, traVerifyUrl);
    } catch (error) {
      throw new ServiceUnavailableException(`Failed to scrape receipt data: ${error.message}`);
    } finally {
      await page.close();
    }

    const receiptDataString = JSON.stringify({
      details: scraped.details,
      items: scraped.items,
      totals: scraped.totalAmounts,
    });
    const receiptDataHash = crypto.createHash('sha256').update(receiptDataString).digest('hex');

    const newReceipt: NewReceipt = {
      userId: userId,
      receiptDataHash,
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
      receiptTime: scraped.receiptTime,
      totalExclTax: scraped.totalAmounts.find(t => t.label === 'TOTAL EXCL OF TAX:')?.amount || '0',
      totalTax: scraped.totalAmounts.find(t => t.label === 'TOTAL TAX:')?.amount || '0',
      totalInclTax: scraped.totalAmounts.find(t => t.label === 'TOTAL INCL OF TAX:')?.amount || '0',
      verificationCode: getReceiptDto.verificationCode,
      verificationCodeUrl: scraped.verificationUrl,
      pdfStatus: 'pending',
    };
    console.log('newReceipt:', newReceipt); // Log the newReceipt object

    let insertedReceipt;
    try {
      const result = await this.db.insert(receipts).values(newReceipt).returning();
      insertedReceipt = result[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('This receipt has already been saved to your account.');
      }
      console.error('Error saving receipt to DB:', error); // Log the actual error
      throw new InternalServerErrorException('Failed to save receipt to the database.');
    }

    if (scraped.items && scraped.items.length > 0) {
      const purchasedItemsToInsert = scraped.items.map(item => ({
        receiptId: insertedReceipt.id,
        description: item.description,
        quantity: item.qty,
        amount: item.amount,
      }));
      await this.db.insert(purchasedItems).values(purchasedItemsToInsert);
    }

    await this.pdfQueue.enqueueJob({ receiptId: insertedReceipt.id, receiptData: { ...insertedReceipt, ...scraped } });

    return { status: 'queued', receiptId: insertedReceipt.id };
  }

  // 2 & 3. List receipts (all or for user)
  async findAll(user: { id: string } | null, options: { page: number; limit: number; companyName?: string; customerName?: string; tin?: string }) {
    console.log('--- ReceiptsService.findAll ---');
    if (user) {
      console.log('Querying receipts for userId:', user.id, typeof user.id);
    }
    const { page, limit, companyName, customerName, tin } = options;
    const offset = (page - 1) * limit;

    const whereClauses: (SQL | undefined)[] = [];
    if (user) {
      // user.id is a UUID string, so use as string
      whereClauses.push(eq(receipts.userId, user.id));
    }
    if (companyName) {
      whereClauses.push(ilike(receipts.companyName, `%${companyName}%`));
    }
    if (customerName) {
      whereClauses.push(ilike(receipts.customerName, `%${customerName}%`));
    }
    if (tin) {
      whereClauses.push(eq(receipts.tin, tin));
    }

    const dataQuery = this.db.select().from(receipts).where(and(...whereClauses.filter(c => c !== undefined))).limit(limit).offset(offset).orderBy(desc(receipts.createdAt));
    const countQuery = this.db.select({ count: sql<number>`count(*)::int` }).from(receipts).where(and(...whereClauses.filter(c => c !== undefined)));

    const [data, countResult] = await Promise.all([dataQuery, countQuery]);

    const total = countResult[0].count;
    const lastPage = Math.ceil(total / limit) || 1;

    return {
      data,
      meta: { total, page, limit, lastPage },
    };
  }

  // 4. Get a single receipt by ID
  async getReceiptById(id: string, requestingUser: { sub: string, role: string }) {
    const receiptId = Number(id);
    console.log('Fetching receipt by PK id:', receiptId, typeof receiptId);
    const receiptArr = await this.db.select().from(receipts).where(eq(receipts.id, receiptId)).limit(1);
    const receipt = receiptArr[0];
    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }
    console.log('Checking ownership: receipt.userId =', receipt.userId, 'requestingUser.sub =', requestingUser.sub);
    if (requestingUser.role !== 'admin' && receipt.userId !== requestingUser.sub) {
      throw new UnauthorizedException('Not authorized to view this receipt');
    }
    console.log('Fetching purchased items for receiptId:', receiptId, typeof receiptId);
    const items = await this.db.select().from(purchasedItems).where(eq(purchasedItems.receiptId, receiptId));
    return { ...receipt, items };
  }

  // 5. Delete a receipt by ID
  async deleteReceipt(id: string, requestingUser: { sub: string, role: string }) {
    const receiptId = Number(id);
    console.log('Deleting receipt by PK id:', receiptId, typeof receiptId);
    const receiptArr = await this.db.select().from(receipts).where(eq(receipts.id, receiptId)).limit(1);
    const receipt = receiptArr[0];
    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }
    if (requestingUser.role !== 'admin' && receipt.userId !== requestingUser.sub) {
      throw new UnauthorizedException('Not authorized to delete this receipt');
    }
    if (receipt.pdfUrl) {
      await this.fileUploadService.deleteFile(receipt.pdfUrl);
    }
    await this.db.delete(receipts).where(eq(receipts.id, receiptId));
  }

  // 6. Export/download a receipt PDF
  async exportReceiptPdf(id: string, requestingUser: { sub: string, role: string }): Promise<Buffer> {
    const receiptId = Number(id);
    console.log('Exporting PDF for receipt PK id:', receiptId, typeof receiptId);
    const receiptArr = await this.db.select().from(receipts).where(eq(receipts.id, receiptId)).limit(1);
    const receipt = receiptArr[0];
    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }
    if (requestingUser.role !== 'admin' && receipt.userId !== requestingUser.sub) {
      throw new UnauthorizedException('Not authorized to export this receipt');
    }
    const items = await this.db.select().from(purchasedItems).where(eq(purchasedItems.receiptId, receiptId));
    return Buffer.from(await this.pdfGenerator.generateReceiptPdf({ ...receipt, items }));
  }

  // User stats endpoint
  async getUserStats(user: { id: string }) {
    // Get all receipts for the user
    const receiptsList = await this.db.select().from(receipts).where(eq(receipts.userId, user.id));
    // Helper to parse numbers from strings with commas
    const parseNum = (val: string | null | undefined) => {
      if (!val) return 0;
      return Number(val.replace(/,/g, ''));
    };
    // Sum up the fields
    const sum = receiptsList.reduce(
      (acc, r) => {
        acc.totalTax += parseNum(r.totalTax);
        acc.totalInclTax += parseNum(r.totalInclTax);
        acc.totalExclTax += parseNum(r.totalExclTax);
        return acc;
      },
      { totalTax: 0, totalInclTax: 0, totalExclTax: 0 }
    );
    // Optionally, return only key fields per receipt
    const receiptsData = receiptsList.map(r => ({
      id: r.id,
      companyName: r.companyName,
      totalTax: parseNum(r.totalTax),
      totalInclTax: parseNum(r.totalInclTax),
      totalExclTax: parseNum(r.totalExclTax),
      receiptDate: r.receiptDate,
      receiptNo: r.receiptNo,
      customerName: r.customerName,
    }));
    // Sum per company
    const companyTax: Record<string, number> = {};
    receiptsList.forEach(r => {
      const company = r.companyName || 'Unknown';
      const tax = parseNum(r.totalTax);
      if (!companyTax[company]) companyTax[company] = 0;
      companyTax[company] += tax;
    });
    return { sum, receipts: receiptsData, companyTax };
  }

  /**
   * Retry PDF generation for a single receipt
   * @param receiptId The ID of the receipt to retry
   * @param userId The ID of the user making the request
   * @returns Object indicating success or failure
   */
  async retryPdfGeneration(receiptId: number, userId: string) {
    this.logger.log(`Retrying PDF generation for receipt ID: ${receiptId}`);

    // Check if receipt exists and belongs to the user
    const receipt = await this.db.query.receipts.findFirst({
      where: and(eq(receipts.id, receiptId), eq(receipts.userId, userId)),
    });

    if (!receipt) {
      throw new NotFoundException(`Receipt with ID ${receiptId} not found or does not belong to this user`);
    }

    // Check if receipt is in a failed state
    if (receipt.pdfStatus !== 'failed' && receipt.pdfStatus !== 'retry_pending') {
      this.logger.warn(`Cannot retry PDF generation for receipt ID: ${receiptId} with status: ${receipt.pdfStatus}`);
      return {
        status: 'error',
        message: `Cannot retry PDF generation for receipt with status: ${receipt.pdfStatus}. Only failed or retry_pending receipts can be retried.`
      };
    }

    // Update receipt status to pending
    await this.db.update(receipts)
      .set({ pdfStatus: 'pending' })
      .where(eq(receipts.id, receiptId));

    // Get the full receipt data needed for PDF generation
    const browser = await this.playwrightService.getBrowser();
    const page = await browser.newPage();
    let scraped;

    try {
      const traVerifyUrl = process.env.TRA_VERIFY_URL;
      if (!traVerifyUrl) {
        throw new Error('TRA_VERIFY_URL environment variable is not set.');
      }

      // Re-scrape the receipt data
      if (!receipt.receiptTime) {
        throw new Error(`Receipt ${receipt.id} has no receiptTime - cannot retry PDF generation`);
      }

      scraped = await this.scraper.scrapeReceipt(
        page,
        receipt.verificationCode,
        receipt.receiptTime,
        traVerifyUrl
      );

      // Re-enqueue the job
      await this.pdfQueue.enqueueJob({
        receiptId: receipt.id,
        receiptData: { ...receipt, ...scraped }
      });

      return { status: 'queued', receiptId: receipt.id };
    } catch (error) {
      this.logger.error(`Failed to retry PDF generation for receipt ID: ${receiptId}`, error);

      // Update receipt status back to failed
      await this.db.update(receipts)
        .set({ pdfStatus: 'failed' })
        .where(eq(receipts.id, receiptId));

      throw new ServiceUnavailableException(`Failed to retry PDF generation: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  /**
   * Retry PDF generation for all failed receipts of a user
   * @param userId The ID of the user making the request
   * @returns Object indicating the number of receipts queued for retry
   */
  async retryAllFailedPdfGenerations(userId: string) {
    this.logger.log(`Retrying all failed PDF generations for user ID: ${userId}`);

    // Find all failed receipts for this user
    const failedReceipts = await this.db.query.receipts.findMany({
      where: and(
        eq(receipts.userId, userId),
        sql`${receipts.pdfStatus} IN ('failed', 'retry_pending')`
      ),
    });

    if (failedReceipts.length === 0) {
      return { status: 'success', message: 'No failed receipts found to retry', count: 0 };
    }

    let successCount = 0;
    let failureCount = 0;

    // Process each failed receipt
    for (const receipt of failedReceipts) {
      try {
        // Update receipt status to pending
        await this.db.update(receipts)
          .set({ pdfStatus: 'pending' })
          .where(eq(receipts.id, receipt.id));

        // Get the full receipt data needed for PDF generation
        const browser = await this.playwrightService.getBrowser();
        const page = await browser.newPage();

        try {
          const traVerifyUrl = process.env.TRA_VERIFY_URL;
          if (!traVerifyUrl) {
            throw new Error('TRA_VERIFY_URL environment variable is not set.');
          }

          // Re-scrape the receipt data
          if (!receipt.receiptTime) {
            throw new Error(`Receipt ${receipt.id} has no receiptTime - cannot retry PDF generation`);
          }

          const scraped = await this.scraper.scrapeReceipt(
            page,
            receipt.verificationCode,
            receipt.receiptTime,
            traVerifyUrl
          );

          // Re-enqueue the job
          await this.pdfQueue.enqueueJob({
            receiptId: receipt.id,
            receiptData: { ...receipt, ...scraped }
          });

          successCount++;
        } catch (error) {
          this.logger.error(`Failed to retry PDF generation for receipt ID: ${receipt.id}`, error);

          // Update receipt status back to failed
          await this.db.update(receipts)
            .set({ pdfStatus: 'failed' })
            .where(eq(receipts.id, receipt.id));

          failureCount++;
        } finally {
          await page.close();
        }
      } catch (error) {
        this.logger.error(`Error processing receipt ID: ${receipt.id}`, error);
        failureCount++;
      }
    }

    return {
      status: 'success',
      message: `Queued ${successCount} receipts for PDF generation retry. Failed to queue ${failureCount} receipts.`,
      count: successCount
    };
  }
}