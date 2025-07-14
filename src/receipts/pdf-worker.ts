import { NestFactory } from '@nestjs/core';
import { chromium, Browser } from 'playwright';
import { eq } from 'drizzle-orm';
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

  async function processJob(job: PdfJob, browser: Browser) {
    console.log(`[Worker] Starting job for receiptId: ${job.receiptId}`);
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
      await db.update(receipts).set({ pdfStatus: 'failed' }).where(eq(receipts.id, job.receiptId));
    }
  }

  async function workerLoop(browser: Browser) {
    console.log('[Worker] Worker loop started, waiting for jobs...');
    while (true) {
      try {
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