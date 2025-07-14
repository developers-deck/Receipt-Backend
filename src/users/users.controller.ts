import { Controller, Get, UseGuards, Param, Delete, Patch, Body, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.Admin)
  async findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(Role.Admin)
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Get(':userId/receipts')
  @Roles(Role.Admin)
  async getReceiptsForUser(
    @Param('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('companyName') companyName?: string,
    @Query('customerName') customerName?: string,
    @Query('tin') tin?: string,
  ) {
    return this.usersService.findReceiptsForUser(userId, {
      page: Number(page),
      limit: Number(limit),
      companyName,
      customerName,
      tin,
    });
  }

  @Delete(':id')
  @Roles(Role.Admin)
  async deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }

  @Patch(':id')
  @Roles(Role.Admin)
  async updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.updateUser(id, updateUserDto);
  }
}
