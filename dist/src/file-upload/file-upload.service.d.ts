import { ConfigService } from '@nestjs/config';
export declare class FileUploadService {
    private configService;
    private readonly s3Client;
    private readonly bucketName;
    constructor(configService: ConfigService);
    uploadFile(buffer: Buffer, fileName: string, contentType: string): Promise<string>;
}
