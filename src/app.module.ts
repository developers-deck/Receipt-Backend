import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ReceiptsModule } from './receipts/receipts.module';
<<<<<<< Updated upstream
import { DrizzleModule } from './db/drizzle.provider';
=======
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FileUploadModule } from './file-upload/file-upload.module';
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes

@Module({
  imports: [
    DrizzleModule,
    ReceiptsModule,
<<<<<<< Updated upstream
=======
    DbModule,
    AuthModule,
    UsersModule,
    FileUploadModule,
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
// import { dotenv } from 'dotenv'; // Remove this line
