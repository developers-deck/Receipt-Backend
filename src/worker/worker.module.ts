import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from '@/db/db.module';
import { FileUploadModule } from '@/file-upload/file-upload.module';
import { PdfGeneratorService } from '@/receipts/pdf-generator.service';
import { PdfQueueService } from '@/receipts/pdf-queue.service';
import { RedisModule } from '@/redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DbModule,
    FileUploadModule,
    RedisModule,
  ],
  providers: [PdfGeneratorService, PdfQueueService],
  exports: [PdfGeneratorService, PdfQueueService],
})
export class WorkerModule {}
