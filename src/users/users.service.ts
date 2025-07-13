import { Injectable, Inject } from '@nestjs/common';
import { DbType } from '../db';
import { DB_PROVIDER } from '../db/db.provider';
import { users, NewUser } from '../db/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@Inject(DB_PROVIDER) private db: DbType) {}

  async findOne(username: string): Promise<any> {
    return this.db.select().from(users).where(eq(users.username, username)).limit(1);
  }

  async create(user: NewUser): Promise<any> {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(user.password, salt);
    const newUser = {
      ...user,
      password: hashedPassword,
    };
    return this.db.insert(users).values(newUser).returning();
  }
}