import { ReceiptsService } from './receipts.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import * as schema from '../db/schema';
export declare class ReceiptsController {
    private readonly receiptsService;
    constructor(receiptsService: ReceiptsService);
    create(createReceiptDto: CreateReceiptDto): Promise<typeof schema.receiptsTable['$inferSelect']>;
    findAll(): Promise<typeof schema.receiptsTable['$inferSelect'][]>;
    findOne(id: string): Promise<typeof schema.receiptsTable['$inferSelect']>;
}
