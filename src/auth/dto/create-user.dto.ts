export class CreateUserDto {
  username: string;
  password?: string;
  role?: 'user' | 'admin';
}