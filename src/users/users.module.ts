import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DbModule } from '../db/db.module';
import { ReceiptsModule } from '../receipts/receipts.module';
import { FileUploadModule } from '../file-upload/file-upload.module';

@Module({
  imports: [DbModule, ReceiptsModule, FileUploadModule], // Import DbModule to use the database connection
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
