import { Module } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { ReceiptsController } from './receipts.controller';
import { HttpModule } from '@nestjs/axios'; // Import HttpModule

@Module({
  imports: [
    HttpModule.register({ // Configure HttpModule if needed (e.g., timeout, base URL)
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  controllers: [ReceiptsController],
  providers: [ReceiptsService],
})
export class ReceiptsModule {}