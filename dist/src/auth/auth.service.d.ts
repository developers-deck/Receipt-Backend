import { JwtService } from '@nestjs/jwt';
import { NewUser } from 'src/db/schema';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from 'src/db/schema';
type DbType = ReturnType<typeof drizzle<typeof schema>>;
export declare class AuthService {
    private db;
    private jwtService;
    constructor(db: DbType, jwtService: JwtService);
    validateUser(username: string, pass: string): Promise<any>;
    login(user: any): Promise<{
        status: string;
        data: {
            access_token: string;
            user: {
                id: any;
                username: any;
                role: any;
            };
        };
    }>;
    createUser(createUserDto: NewUser): Promise<any>;
}
export {};
