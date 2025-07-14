import { Controller, Post, Body, Get, Param, UseGuards, Request, Delete, HttpCode, HttpStatus, Query, Response, Res, Logger } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { GetReceiptDto } from './dto/get-receipt.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { Response as ExpressResponse } from 'express';

@Controller('receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReceiptsController {
  private readonly logger = new Logger(ReceiptsController.name);

  constructor(private readonly receiptsService: ReceiptsService) {}

  // 1. Create a new receipt (scrape and save)
  @Post()
  @Roles(Role.User, Role.Admin)
  async createReceipt(@Body() getReceiptDto: GetReceiptDto, @Request() req) {
    const userId = req.user.sub;
    return this.receiptsService.createReceipt(getReceiptDto, userId);
  }

  // 2. List all receipts (admin only, paginated, filterable)
  @Get()
  @Roles(Role.Admin)
  async getAllReceipts(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('companyName') companyName?: string,
    @Query('customerName') customerName?: string,
    @Query('tin') tin?: string,
  ) {
    return this.receiptsService.findAll(null, { page: +page, limit: +limit, companyName, customerName, tin });
  }

  // 3. List receipts for the current user (paginated, filterable)
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
    this.logger.log(`[findMyReceipts] - Initiated for user: ${JSON.stringify(req.user)}`);
    console.log('req.user:', req.user);
    const user = { id: req.user.id };
    return this.receiptsService.findAll(user, { page: +page, limit: +limit, companyName, customerName, tin });
  }

  // 4. Get a single receipt by ID
  @Get(':id')
  @Roles(Role.User, Role.Admin)
  async getReceiptById(@Param('id') id: string, @Request() req) {
    return this.receiptsService.getReceiptById(id, req.user);
  }

  // 5. Delete a receipt by ID
  @Delete(':id')
  @Roles(Role.User, Role.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteReceipt(@Param('id') id: string, @Request() req) {
    await this.receiptsService.deleteReceipt(id, req.user);
  }

  // 6. Export/download a receipt PDF (User/Admin)
  @Get(':id/pdf')
  @HttpCode(200)
  async downloadPdf(@Param('id') id: string, @Request() req, @Res() res: ExpressResponse) {
    const pdfBuffer = await this.receiptsService.exportReceiptPdf(id, req.user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${id}.pdf`);
    res.send(pdfBuffer);
  }

  // User stats endpoint
  @Get('mine/stats')
  @Roles(Role.User, Role.Admin)
  async getMyStats(@Request() req) {
    const user = { id: req.user.id };
    return this.receiptsService.getUserStats(user);
  }
}