import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    login(req: any): Promise<{
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
    register(registerDto: RegisterDto): Promise<any>;
}
