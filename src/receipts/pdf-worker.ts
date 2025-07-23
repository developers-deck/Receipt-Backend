import { NestFactory } from '@nestjs/core';
import { chromium, Browser } from 'playwright';
import { eq, sql } from 'drizzle-orm';
import { WorkerModule } from '@/worker/worker.module';
import { PdfQueueService, PdfJob } from '@/receipts/pdf-queue.service';
import { PdfGeneratorService } from '@/receipts/pdf-generator.service';
import { FileUploadService } from '@/file-upload/file-upload.service';
import { DB_PROVIDER, DbType } from '@/db/db.provider';
import { receipts } from '@/db/schema';

async function main() {
  console.log('[Worker] Bootstrapping NestJS application context...');
  const app = await NestFactory.createApplicationContext(WorkerModule);
  console.log('[Worker] Application context created.');

  const pdfQueue = app.get(PdfQueueService);
  const pdfGenerator = app.get(PdfGeneratorService);
  const fileUploadService = app.get(FileUploadService);
  const db = app.get<DbType>(DB_PROVIDER);

  console.log('[Worker] Initializing browser...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  console.log('[Worker] Browser initialized.');

  process.on('SIGINT', async () => {
    console.log('[Worker] SIGINT received, shutting down...');
    await browser.close();
    await app.close();
    process.exit(0);
  });

  async function processJob(job: PdfJob, browser: Browser, retryCount = 0) {
    const maxRetries = 3; // Maximum number of retry attempts
    console.log(`[Worker] Starting job for receiptId: ${job.receiptId}${retryCount > 0 ? ` (Retry attempt ${retryCount}/${maxRetries})` : ''}`);
    try {
      await db.update(receipts).set({ pdfStatus: 'processing' }).where(eq(receipts.id, job.receiptId));
      const htmlContent = await pdfGenerator.generateReceiptPdf(job.receiptData);
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle' });
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
      await page.close();
      const pdfUrl = await fileUploadService.upload(pdfBuffer, 'application/pdf');
      await db.update(receipts).set({ pdfUrl, pdfStatus: 'done' }).where(eq(receipts.id, job.receiptId));
      console.log(`[Worker] Successfully processed job for receiptId: ${job.receiptId}, url: ${pdfUrl}`);
    } catch (err) {
      console.error(`[Worker] Error processing job for receiptId: ${job.receiptId}`, err);
      
      if (retryCount < maxRetries) {
        console.log(`[Worker] Scheduling retry ${retryCount + 1}/${maxRetries} for receiptId: ${job.receiptId}`);
        await db.update(receipts).set({ pdfStatus: 'retry_pending' }).where(eq(receipts.id, job.receiptId));
        
        // Wait before retrying (exponential backoff)
        const delayMs = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s, etc.
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        // Retry the job
        return processJob(job, browser, retryCount + 1);
      } else {
        console.error(`[Worker] Maximum retry attempts (${maxRetries}) reached for receiptId: ${job.receiptId}`);
        await db.update(receipts).set({ pdfStatus: 'failed' }).where(eq(receipts.id, job.receiptId));
      }
    }
  }

  async function checkForFailedJobs(browser: Browser) {
    console.log('[Worker] Checking for failed jobs...');
    try {
      // Find receipts with 'failed' status that haven't been retried recently
      // We'll consider jobs that have been in 'failed' status for at least 30 minutes
      const failedReceipts = await db.query.receipts.findMany({
        where: sql`${receipts.pdfStatus} = 'failed' AND ${receipts.createdAt} < NOW() - INTERVAL '30 minutes'`,
        limit: 10, // Process a batch of 10 at a time
      });

      if (failedReceipts.length > 0) {
        console.log(`[Worker] Found ${failedReceipts.length} failed jobs to auto-retry`);
        
        for (const receipt of failedReceipts) {
          // Update status to retry_pending
          await db.update(receipts)
            .set({ pdfStatus: 'retry_pending' })
            .where(eq(receipts.id, receipt.id));
            
          console.log(`[Worker] Auto-retrying job for receiptId: ${receipt.id}`);
          
          // We need to get the full receipt data for PDF generation
          // This would typically include the scraped data
          // For simplicity, we'll just use what we have in the database
          const job = {
            receiptId: receipt.id,
            receiptData: receipt,
          };
          
          // Enqueue the job for processing
          await pdfQueue.enqueueJob(job);
        }
      }
    } catch (error) {
      console.error('[Worker] Error checking for failed jobs:', error);
    }
  }

  async function workerLoop(browser: Browser) {
    console.log('[Worker] Worker loop started, waiting for jobs...');
    let lastFailedJobCheck = Date.now();
    const failedJobCheckInterval = 5 * 60 * 1000; // Check every 5 minutes
    
    while (true) {
      try {
        // Check for failed jobs periodically
        const now = Date.now();
        if (now - lastFailedJobCheck > failedJobCheckInterval) {
          await checkForFailedJobs(browser);
          lastFailedJobCheck = now;
        }
        
        // Process regular jobs from the queue
        const job = await pdfQueue.dequeueJob();
        if (job) {
          await processJob(job, browser);
        } else {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error('[Worker] Error in worker loop:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  await workerLoop(browser);
}

main().catch(error => {
  console.error('[Worker] An unhandled error occurred during startup:', error);
  process.exit(1);
});