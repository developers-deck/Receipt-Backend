import { Redis } from '@upstash/redis';
import { Injectable, Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '../redis/redis.provider';

export interface PdfJob {
  receiptId: number;
  receiptData: any;
}

@Injectable()
export class PdfQueueService {
  private readonly queueKey = 'pdf-jobs';

  constructor(@Inject(REDIS_CLIENT) private redis: Redis) {}

  async enqueueJob(job: PdfJob): Promise<void> {
        const result = await this.redis.rpush(this.queueKey, JSON.stringify(job));
    console.log(`[PdfQueueService] RPUSH command sent. New queue length: ${result}`);
  }

  async dequeueJob(): Promise<PdfJob | null> {
        const jobData = await this.redis.lpop(this.queueKey);

    if (!jobData) {
      return null;
    }

    console.log(`[PdfQueueService] Dequeued job data:`, jobData);

    // The Upstash client can auto-parse JSON. If it's an object, use it directly.
    // If it's a string, we need to parse it.
    if (typeof jobData === 'object') {
      return jobData as PdfJob;
    }

    if (typeof jobData === 'string') {
      try {
        return JSON.parse(jobData) as PdfJob;
      } catch (error) {
        console.error('[PdfQueueService] Failed to parse job string from queue:', error, 'Job data:', jobData);
        return null;
      }
    }

    console.error('[PdfQueueService] Dequeued job is not a string or object, cannot process.', jobData);
    return null;
  }

  async queueLength(): Promise<number> {
    return await this.redis.llen(this.queueKey);
  }
}