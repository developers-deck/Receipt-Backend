import { IsString, IsNotEmpty, IsDateString, IsNumber, IsOptional, Matches, IsArray } from 'class-validator';

export class CreateReceiptDto {
  @IsString()
  @IsNotEmpty()
  receiptNumber: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, {
    message: 'verificationSecret must be in HH:MM:SS format',
  })
  verificationSecret: string;

  @IsDateString()
  issueDate: Date;

  @IsNumber()
  totalAmount: number;

  @IsArray()
  @IsOptional()
  items?: Record<string, any>[];

  @IsString()
  @IsNotEmpty()
  customerName: string;
}