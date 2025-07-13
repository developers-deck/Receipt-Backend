import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class FileUploadService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    const bucketName = this.configService.get<string>('B2_BUCKET_NAME');
    const endpoint = this.configService.get<string>('B2_ENDPOINT');
    const accessKeyId = this.configService.get<string>('B2_APPLICATION_KEY_ID');
    const secretAccessKey = this.configService.get<string>('B2_APPLICATION_KEY');

    if (!bucketName || !endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error('Backblaze B2 credentials are not fully configured in .env file');
    }

    this.bucketName = bucketName;
    this.s3Client = new S3Client({
      endpoint,
      region: 'us-west-000', // This is often a placeholder for B2, the endpoint is key
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async uploadFile(buffer: Buffer, fileName: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);

    // Construct the public URL for the file
    return `https://f000.backblazeb2.com/file/${this.bucketName}/${fileName}`;
  }
}
