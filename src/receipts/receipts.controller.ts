import { Controller, Post, Body, HttpCode, HttpStatus, Get, Param, ParseUUIDPipe, NotFoundException, BadRequestException } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import * as schema from '../db/schema';
// import { dotenv } from 'dotenv'; // Removed this problematic import

@Controller('receipts')
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
  async findAll(): Promise<typeof schema.receiptsTable['$inferSelect'][]> {
    return this.receiptsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<typeof schema.receiptsTable['$inferSelect']> {
    const receipt = await this.receiptsService.findOne(id);
    if (!receipt) {
      throw new NotFoundException(`Receipt with ID ${id} not found`);
    }
    return receipt;
  }
}