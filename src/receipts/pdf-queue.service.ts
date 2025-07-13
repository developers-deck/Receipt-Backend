import { Redis } from '@upstash/redis';

export interface PdfJob {
  receiptId: number;
  receiptData: any;
}

export class PdfQueueService {
  private redis: Redis;
  private readonly queueKey = 'pdf-jobs';

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  async enqueueJob(job: PdfJob): Promise<void> {
    await this.redis.rpush(this.queueKey, JSON.stringify(job));
  }

  async dequeueJob(): Promise<PdfJob | null> {
    const res = await this.redis.lpop(this.queueKey);
    if (!res || typeof res !== 'string') return null;
    try {
      return JSON.parse(res) as PdfJob;
    } catch (e) {
      console.error('Failed to parse PdfJob from Redis:', e);
      return null;
    }
  }

  async queueLength(): Promise<number> {
    return await this.redis.llen(this.queueKey);
  }
}

// Simple test for Upstash Redis connection and queue functionality
if (require.main === module) {
  (async () => {
    const queue = new PdfQueueService();
    const testJob: PdfJob = { receiptId: 123, receiptData: { test: true } };
    console.log('Enqueuing test job:', testJob);
    await queue.enqueueJob(testJob);
    const len = await queue.queueLength();
    console.log('Queue length after enqueue:', len);
    const dequeued = await queue.dequeueJob();
    console.log('Dequeued job:', dequeued);
    const lenAfter = await queue.queueLength();
    console.log('Queue length after dequeue:', lenAfter);
    process.exit(0);
  })().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
} 