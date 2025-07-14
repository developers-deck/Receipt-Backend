import { PdfQueueService, PdfJob } from './pdf-queue.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { FileUploadService } from '../file-upload/file-upload.service';
import { receipts } from '../db/schema';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { chromium, Browser } from 'playwright';
import * as dotenv from 'dotenv';
dotenv.config();

// Setup DB connection using drizzle and Pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
const db = drizzle(pool, { schema: { receipts } });

// Create a mock ConfigService for the worker
class MockConfigService {
  get(key: string): string | undefined {
    return process.env[key];
  }
}

const fileUploadService = new FileUploadService(new MockConfigService() as any);
const pdfGenerator = new PdfGeneratorService();
const pdfQueue = new PdfQueueService();

let browser: Browser | null = null;

async function processJob(job: PdfJob, browser: Browser) {
  try {
    console.log(`Processing PDF job for receiptId: ${job.receiptId}`);
    // Set status to 'processing'
    await db.update(receipts).set({ pdfStatus: 'processing' }).where(eq(receipts.id, job.receiptId));
    // Generate PDF
    const htmlContent = await pdfGenerator.generateReceiptPdf(job.receiptData);
    // Use Playwright to render the PDF
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await page.close();
    // Upload PDF
    const pdfUrl = await fileUploadService.upload(pdfBuffer, 'application/pdf');
    // Update receipt with PDF URL and status 'done'
    await db.update(receipts).set({ pdfUrl, pdfStatus: 'done' }).where(eq(receipts.id, job.receiptId));
    console.log(`PDF uploaded and DB updated for receiptId: ${job.receiptId}, url: ${pdfUrl}`);
  } catch (err) {
    // On error, set status to 'failed'
    await db.update(receipts).set({ pdfStatus: 'failed' }).where(eq(receipts.id, job.receiptId));
    console.error(`Failed to process PDF job for receiptId: ${job.receiptId}`, err);
  }
}

async function startWorker() {
  console.log('Initializing browser for worker...');
  browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  console.log('Browser initialized.');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Closing browser...');
    if (browser) {
      await browser.close();
    }
    process.exit(0);
  });

  await workerLoop(browser);
}

async function workerLoop(browser: Browser) {
  while (true) {
    const job = await pdfQueue.dequeueJob();
    if (job) {
      await processJob(job, browser);
    } else {
      await new Promise(res => setTimeout(res, 5000)); // Wait before polling again
    }
  }
}

startWorker().catch(err => {
  console.error('Worker failed to start:', err);
  process.exit(1);
}); 