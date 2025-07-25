import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { DB_PROVIDER, DbType } from '../db/db.provider';
import { users, receipts } from '../db/schema';
import { eq } from 'drizzle-orm';
import { ReceiptsService } from '../receipts/receipts.service';
import { FileUploadService } from '../file-upload/file-upload.service';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DB_PROVIDER) private readonly db: DbType,
    private readonly receiptsService: ReceiptsService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  async findOne(userId: string) {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async deleteUser(userId: string) {
    const userReceipts = await this.db.query.receipts.findMany({
      where: eq(receipts.userId, userId),
    });

    for (const receipt of userReceipts) {
      if (receipt.pdfUrl) {
        await this.fileUploadService.deleteFile(receipt.pdfUrl);
      }
    }

    await this.db.delete(users).where(eq(users.id, userId));

    return { message: `User with ID ${userId} and all associated data has been deleted.` };
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto) {
    const { username, password } = updateUserDto;

    const [user] = await this.db.select().from(users).where(eq(users.id, userId));

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const updateData: Partial<{ username: string; passwordHash: string }> = {};

    if (username) {
      const [existingUser] = await this.db.select().from(users).where(eq(users.username, username));
      if (existingUser && existingUser.id !== userId) {
        throw new BadRequestException('Username is already taken');
      }
      updateData.username = username;
    }

    if (password) {
      const salt = await bcrypt.genSalt();
      updateData.passwordHash = await bcrypt.hash(password, salt);
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No update data provided');
    }

    await this.db.update(users).set(updateData).where(eq(users.id, userId));

    return { message: `User with ID ${userId} has been updated.` };
  }

  async findAll() {
    const allUsers = await this.db.query.users.findMany();

    // Exclude password hash from the result
    return allUsers.map(user => {
      const { passwordHash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  async findReceiptsForUser(userId: string, options: { page: number; limit: number; companyName?: string; customerName?: string; tin?: string }) {
    // Find user for proper scoping (findAll expects user object or null)
    const user = await this.db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new NotFoundException(`User with ID ${userId} not found`);
    return this.receiptsService.findAll(user, options);
  }
}
