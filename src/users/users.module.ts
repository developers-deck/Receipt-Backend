import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DbModule } from '../db/db.module';
import { ReceiptsModule } from '../receipts/receipts.module';

@Module({
  imports: [DbModule, ReceiptsModule], // Import DbModule to use the database connection
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
