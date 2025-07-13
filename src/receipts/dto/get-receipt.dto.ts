import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class GetReceiptDto {
  @IsString()
  @IsNotEmpty()
  verificationCode: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'receiptTime must be in HH:MM format',
  })
  receiptTime: string;
}
