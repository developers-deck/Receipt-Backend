import { ConfigService } from '@nestjs/config';
export declare class FileUploadService {
    private configService;
    private readonly s3Client;
    private readonly bucketName;
    private readonly region;
    constructor(configService: ConfigService);
    upload(fileBuffer: Buffer, mimeType: string): Promise<string>;
}
