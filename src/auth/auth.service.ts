import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DB_PROVIDER } from 'src/db/db.provider';
import { DbType } from 'src/db';
import { users, NewUser } from 'src/db/schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB_PROVIDER) private db: DbType,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (user && (await bcrypt.compare(pass, user.passwordHash))) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { username: user.username, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async createUser(createUserDto: NewUser): Promise<any> {
    const { passwordHash, ...rest } = createUserDto;
    const hashedPassword = await bcrypt.hash(passwordHash, 10);

    const newUser = await this.db
      .insert(users)
      .values({ ...rest, passwordHash: hashedPassword })
      .returning({ id: users.id, username: users.username, role: users.role });

    return newUser[0];
  }
}
