<<<<<<< Updated upstream
import { Controller, Post, Body, HttpCode, HttpStatus, Get, Param, ParseUUIDPipe, NotFoundException, BadRequestException } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import * as schema from '../db/schema';
// import { dotenv } from 'dotenv'; // Removed this problematic import
=======
import { Controller, Get, Param, NotFoundException, UseGuards, Request, Post, Body } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetReceiptDto } from './dto/get-receipt.dto';
>>>>>>> Stashed changes

@Controller('receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createReceiptDto: CreateReceiptDto): Promise<typeof schema.receiptsTable['$inferSelect']> {
    try {
      return await this.receiptsService.createAndVerifyReceipt(createReceiptDto);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error.code === '23505') { // PostgreSQL unique violation code
        throw new BadRequestException('Receipt number already exists');
      }
      throw error;
    }
  }

  @Get()
<<<<<<< Updated upstream
  async findAll(): Promise<typeof schema.receiptsTable['$inferSelect'][]> {
    return this.receiptsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<typeof schema.receiptsTable['$inferSelect']> {
    const receipt = await this.receiptsService.findOne(id);
=======
  @Roles('admin')
  async getAllReceipts() {
    return await this.receiptsService.getAllReceipts();
  }

  @Post()
  async getReceipt(@Request() req, @Body() getReceiptDto: GetReceiptDto) {
    const { verificationCode, receiptTime } = getReceiptDto;
    const receipt = await this.receiptsService.getReceipt(verificationCode, receiptTime, req.user.userId);
    if (!receipt) {
      throw new NotFoundException('Failed to get receipt data.');
    }
    return receipt;
  }

  @Get('my-receipts')
  async getMyReceipts(@Request() req) {
    return await this.receiptsService.getReceiptsByUserId(req.user.userId);
  }

  @Get(':id')
  async getReceiptById(@Param('id') id: string, @Request() req) {
    const receipt = await this.receiptsService.getReceiptById(+id, req.user);
>>>>>>> Stashed changes
    if (!receipt) {
      throw new NotFoundException(`Receipt with ID ${id} not found`);
    }
    return receipt;
  }
}