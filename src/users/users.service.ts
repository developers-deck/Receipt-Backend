import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DB_PROVIDER, DbType } from '../db/db.provider';
import { users, receipts } from '../db/schema';
import { eq } from 'drizzle-orm';
import { ReceiptsService } from '../receipts/receipts.service';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB_PROVIDER) private readonly db: DbType,
    private readonly receiptsService: ReceiptsService,
  ) {}

  async findOneWithReceipts(userId: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const userReceipts = await this.receiptsService.getReceiptsByUserId(user.id);
    const { passwordHash, ...userWithoutPassword } = user;
    return {
      status: 'success',
      data: {
        ...userWithoutPassword,
        receipts: userReceipts,
      },
    };
  }

  async findAllWithReceipts() {
    const allUsers = await this.db.select().from(users);

    const usersWithReceipts = await Promise.all(
      allUsers.map(async (user) => {
        const userReceipts = await this.receiptsService.getReceiptsByUserId(user.id);
        const { passwordHash, ...userWithoutPassword } = user;
        return {
          ...userWithoutPassword,
          receipts: userReceipts,
        };
      }),
    );

    return {
      status: 'success',
      data: usersWithReceipts,
    };
  }
}
