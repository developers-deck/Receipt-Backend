import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ReceiptsModule } from './receipts/receipts.module';
import { ConfigModule } from '@nestjs/config';
import { dbProvider } from './db/db.provider';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ReceiptsModule,
  ],
  controllers: [AppController],
  providers: [AppService, dbProvider],
})
export class AppModule {}
