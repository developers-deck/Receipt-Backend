import { JwtService } from '@nestjs/jwt';
import { DbType } from 'src/db';
import { NewUser } from 'src/db/schema';
export declare class AuthService {
    private db;
    private jwtService;
    constructor(db: DbType, jwtService: JwtService);
    validateUser(username: string, pass: string): Promise<any>;
    login(user: any): Promise<{
        access_token: string;
    }>;
    createUser(createUserDto: NewUser): Promise<any>;
}
