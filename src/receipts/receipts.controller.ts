import { Controller, Get, Query, Param } from '@nestjs/common';
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
      return { error: 'Receipt time is required.' };
    }
    const receipt = await this.receiptsService.getReceipt(verificationCode, receiptTime);
    if (!receipt) {
      return { error: 'Failed to get receipt data.' };
    }
    return receipt;
  }

  @Get(':id')
  async getReceiptById(@Param('id') id: string) {
    return await this.receiptsService.getReceiptById(+id);
  }

  @Get('by-company/:companyName')
  async getReceiptsByCompanyName(@Param('companyName') companyName: string) {
    return await this.receiptsService.getReceiptsByCompanyName(companyName);
  }
}