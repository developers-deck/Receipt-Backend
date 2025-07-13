import { IsString, IsNotEmpty } from 'class-validator';

export class GetReceiptDto {
  @IsString()
  @IsNotEmpty()
  verificationCode: string;

  @IsString()
  @IsNotEmpty()
  receiptTime: string;
}
