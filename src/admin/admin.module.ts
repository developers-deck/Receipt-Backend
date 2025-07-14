import { Module } from '@nestjs/common';
import { AdminController } from '@/admin/admin.controller';
import { AdminService } from '@/admin/admin.service';
import { AuthModule } from '@/auth/auth.module';
import { DbModule } from '@/db/db.module';

@Module({
  imports: [AuthModule, DbModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
