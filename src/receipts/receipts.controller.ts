import { Controller, Get, Query, Param, NotFoundException, BadRequestException } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';

@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Get()
  async getAllReceipts() {
    return await this.receiptsService.getAllReceipts();
  }

  @Get(':verificationCode')
  async getReceipt(
    @Param('verificationCode') verificationCode: string,
    @Query('time') receiptTime: string,
  ) {
    if (!receiptTime) {
      throw new BadRequestException('Receipt time is required.');
    }
    const receipt = await this.receiptsService.getReceipt(verificationCode, receiptTime);
    if (!receipt) {
      throw new NotFoundException('Failed to get receipt data.');
    }
    return receipt;
  }

  @Get('id/:id')
  async getReceiptById(@Param('id') id: string) {
    const receipt = await this.receiptsService.getReceiptById(+id);
    if (!receipt) {
      throw new NotFoundException(`Receipt with ID ${id} not found`);
    }
    return receipt;
  }

  @Get('by-company/:companyName')
  async getReceiptsByCompanyName(@Param('companyName') companyName: string) {
    return await this.receiptsService.getReceiptsByCompanyName(companyName);
  }
}