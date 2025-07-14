import { PdfQueueService, PdfJob } from './pdf-queue.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { FileUploadService } from '../file-upload/file-upload.service';
import { receipts } from '../db/schema';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { Redis } from '@upstash/redis';
import { chromium, Browser } from 'playwright';
import * as dotenv from 'dotenv';
import * as path from 'path';

// --- Configuration Loading ---
const envPath = path.resolve(process.cwd(), '.env');
console.log(`[Worker] Loading .env file from: ${envPath}`);
dotenv.config({ path: envPath });

console.log(`[Worker] UPSTASH_REDIS_REST_URL: ${process.env.UPSTASH_REDIS_REST_URL ? 'Loaded' : 'NOT LOADED'}`);
console.log(`[Worker] UPSTASH_REDIS_REST_TOKEN: ${process.env.UPSTASH_REDIS_REST_TOKEN ? 'Loaded' : 'NOT LOADED'}`);

// --- Service Initialization ---
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
const db = drizzle(pool, { schema: { receipts } });

class MockConfigService {
  get(key: string): string | undefined {
    return process.env[key];
  }
}

const fileUploadService = new FileUploadService(new MockConfigService() as any);
const pdfGenerator = new PdfGeneratorService();
const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
const pdfQueue = new PdfQueueService(redisClient);

// --- Core Job Processing Logic ---
async function processJob(job: PdfJob, browser: Browser) {
  console.log(`[Worker] Starting job for receiptId: ${job.receiptId}`);
  try {
    console.log(`[Worker] Step 1: Updating status to 'processing' for receiptId: ${job.receiptId}`);
    await db.update(receipts).set({ pdfStatus: 'processing' }).where(eq(receipts.id, job.receiptId));

    console.log(`[Worker] Step 2: Generating HTML content for receiptId: ${job.receiptId}`);
    const htmlContent = await pdfGenerator.generateReceiptPdf(job.receiptData);
    console.log(`[Worker] Step 3: HTML content generated. Creating PDF with Playwright for receiptId: ${job.receiptId}`);
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
    await page.close();
    console.log(`[Worker] Step 4: PDF buffer created. Uploading to file service for receiptId: ${job.receiptId}`);

    const pdfUrl = await fileUploadService.upload(pdfBuffer, 'application/pdf');
    console.log(`[Worker] Step 5: PDF uploaded. Updating status to 'done' for receiptId: ${job.receiptId}`);
    await db.update(receipts).set({ pdfUrl, pdfStatus: 'done' }).where(eq(receipts.id, job.receiptId));
    console.log(`[Worker] Successfully processed job for receiptId: ${job.receiptId}, url: ${pdfUrl}`);
  } catch (err) {
    console.error(`[Worker] An error occurred while processing job for receiptId: ${job.receiptId}`, err);
    try {
      await db.update(receipts).set({ pdfStatus: 'failed' }).where(eq(receipts.id, job.receiptId));
      console.log(`[Worker] Successfully updated status to 'failed' for receiptId: ${job.receiptId}`);
    } catch (dbError) {
      console.error(`[Worker] CRITICAL: Failed to update status to 'failed' for receiptId: ${job.receiptId}`, dbError);
    }
  }
}

// --- Worker Loop ---
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
      console.error('[Worker] An error occurred in the worker loop:', error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// --- Main Application Entry Point ---
async function main() {
  console.log('[Worker] Initializing browser...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  console.log('[Worker] Browser initialized.');

  process.on('SIGINT', async () => {
    console.log('[Worker] SIGINT received, shutting down browser...');
    await browser.close();
    process.exit(0);
  });

  await workerLoop(browser);
}

main().catch(error => {
  console.error('[Worker] An unhandled error occurred during startup:', error);
  process.exit(1);
});

// Keep the process alive. This is a workaround for cases where the event loop might empty unexpectedly.
setInterval(() => {}, 1 << 30);