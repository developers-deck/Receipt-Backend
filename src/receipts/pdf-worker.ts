import { PdfQueueService, PdfJob } from './pdf-queue.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { FileUploadService } from '../file-upload/file-upload.service';
import { receipts } from '../db/schema';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
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

async function processJob(job: PdfJob) {
  try {
    console.log(`Processing PDF job for receiptId: ${job.receiptId}`);
    // Set status to 'processing'
    await db.update(receipts).set({ pdfStatus: 'processing' }).where(eq(receipts.id, job.receiptId));
    // Generate PDF
    const htmlContent = await pdfGenerator.generateReceiptPdf(job.receiptData);
    // Use Playwright or Puppeteer to render PDF (simulate here)
    // const pdfBuffer = await renderPdf(htmlContent);
    // For demo, just use the HTML as a buffer
    const pdfBuffer = Buffer.from(htmlContent, 'utf-8');
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

async function workerLoop() {
  while (true) {
    const job = await pdfQueue.dequeueJob();
    if (job) {
      await processJob(job);
    } else {
      await new Promise(res => setTimeout(res, 5000)); // Wait before polling again
    }
  }
}

workerLoop(); 