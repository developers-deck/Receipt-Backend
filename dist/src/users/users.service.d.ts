import { DbType } from '../db';
import { NewUser } from '../db/schema';
export declare class UsersService {
    private db;
    constructor(db: DbType);
    findOne(username: string): Promise<any>;
    create(user: NewUser): Promise<any>;
}
