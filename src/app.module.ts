import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ReceiptsModule } from './receipts/receipts.module';
import { DrizzleModule } from './db/drizzle.provider';

@Module({
  imports: [
    DrizzleModule,
    ReceiptsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
// import { dotenv } from 'dotenv'; // Remove this line
