import { Module } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { ReceiptsController } from './receipts.controller';
import { DbModule } from '../db/db.module';
import { RedisModule } from '../redis/redis.module';
import { FileUploadModule } from '../file-upload/file-upload.module';
import { PlaywrightModule } from '../playwright/playwright.module';
import { PdfGeneratorService } from './pdf-generator.service';
import { ScraperService } from './scraper.service';
import { PdfQueueService } from './pdf-queue.service';

@Module({
    imports: [DbModule, FileUploadModule, RedisModule, PlaywrightModule],
  controllers: [ReceiptsController],
  providers: [
    ReceiptsService,
    PdfGeneratorService,
    ScraperService,
    PdfQueueService,
  ],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}