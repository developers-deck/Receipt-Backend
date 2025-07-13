import { Module } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { ReceiptsController } from './receipts.controller';
import { DbModule } from '../db/db.module';
import { FileUploadModule } from '../file-upload/file-upload.module';

@Module({
  imports: [DbModule, FileUploadModule],
  controllers: [ReceiptsController],
  providers: [ReceiptsService],
})
export class ReceiptsModule {}