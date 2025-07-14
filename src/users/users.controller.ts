import { Controller, Get, UseGuards, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.Admin)
  async getAllUsersWithReceipts() {
    return this.usersService.findAllWithReceipts();
  }

  @Get(':id')
  @Roles(Role.Admin)
  async getUserWithReceipts(@Param('id') id: string) {
    return this.usersService.findOneWithReceipts(id);
  }
}
