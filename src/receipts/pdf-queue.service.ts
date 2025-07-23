import { Redis } from '@upstash/redis';
import { Injectable, Inject, Logger } from '@nestjs/common';
import { REDIS_CLIENT } from '../redis/redis.provider';

export interface PdfJob {
  receiptId: number;
  receiptData: any;
}

@Injectable()
export class PdfQueueService {
  private readonly queueKey = 'pdf-jobs';
  private readonly logger = new Logger(PdfQueueService.name);

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

  /**
   * Re-enqueue a job that previously failed
   * @param job The job to re-enqueue
   * @returns void
   */
  async requeueFailedJob(job: PdfJob): Promise<void> {
    this.logger.log(`Re-enqueueing failed job for receiptId: ${job.receiptId}`);
    await this.enqueueJob(job);
  }

  /**
   * Re-enqueue all jobs with failed status
   * @param failedJobs Array of failed jobs to re-enqueue
   * @returns The number of jobs that were re-enqueued
   */
  async requeueAllFailedJobs(failedJobs: PdfJob[]): Promise<number> {
    if (!failedJobs || failedJobs.length === 0) {
      this.logger.log('No failed jobs to re-enqueue');
      return 0;
    }

    this.logger.log(`Re-enqueueing ${failedJobs.length} failed jobs`);
    
    for (const job of failedJobs) {
      await this.enqueueJob(job);
    }

    return failedJobs.length;
  }
}