import { Controller, Post, Body, Get, Param, UseGuards, Request, UnauthorizedException, NotFoundException, Delete, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { GetReceiptDto } from './dto/get-receipt.dto';
import { Roles } from 'src/auth/roles.decorator';
import { Role } from 'src/auth/enums/role.enum';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { User } from '../db/schema';

@Controller('receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Post()
  @Roles(Role.User, Role.Admin)
  async createReceipt(@Body() getReceiptDto: GetReceiptDto, @Request() req) {
    const { verificationCode, receiptTime } = getReceiptDto;
    const userId = req.user.userId;
    return this.receiptsService.getReceipt(verificationCode, receiptTime, userId);
  }

  @Get()
  @Roles(Role.Admin)
  async getAllReceipts(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('companyName') companyName?: string,
    @Query('customerName') customerName?: string,
    @Query('tin') tin?: string,
  ) {
    return this.receiptsService.findAll(null, {
      page: +page,
      limit: +limit,
      companyName,
      customerName,
      tin,
    });
  }

  @Get('user/:userId')
  @Roles(Role.Admin)
  async getReceiptsForUser(@Param('userId') userId: string) {
    // This endpoint is for admins to get all receipts for a specific user.
    return this.receiptsService.getReceiptsByUserId(userId);
  }

  @Get('mine')
  @Roles(Role.User, Role.Admin)
  async findMyReceipts(
    @Request() req,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('companyName') companyName?: string,
    @Query('customerName') customerName?: string,
    @Query('tin') tin?: string,
  ) {
    const user = req.user as User;
    return this.receiptsService.findAll(user, {
      page: +page,
      limit: +limit,
      companyName,
      customerName,
      tin,
    });
  }

  @Get(':id')
  @Roles(Role.Admin, Role.User)
  async getReceiptById(@Param('id') id: string, @Request() req) {
    const receiptId = id;
    const requestingUser = req.user;

    const receipt = await this.receiptsService.getReceiptById(receiptId);

    if (!receipt) {
      throw new NotFoundException(`Receipt with ID ${id} not found`);
    }

    // Enforce data isolation: Users can only access their own receipts.
    if (requestingUser.role !== Role.Admin && receipt.userId !== requestingUser.userId) {
      throw new UnauthorizedException('You are not authorized to access this receipt.');
    }

    return receipt;
  }

  @Delete(':id')
  @Roles(Role.User, Role.Admin)
  @HttpCode(HttpStatus.NO_CONTENT) // Return 204 No Content on success
  async deleteReceipt(@Param('id') id: string, @Request() req) {
    const receiptId = parseInt(id, 10);
    if (isNaN(receiptId)) {
      throw new NotFoundException(`Invalid receipt ID: ${id}`);
    }

    await this.receiptsService.deleteReceipt(receiptId, req.user);
  }
}