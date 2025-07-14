import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FileUploadService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('B2_REGION');
    const endpoint = this.configService.get<string>('B2_ENDPOINT');
    const accessKeyId = this.configService.get<string>('B2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('B2_SECRET_ACCESS_KEY');
    const bucketName = this.configService.get<string>('B2_BUCKET_NAME');

    if (!region || !endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new InternalServerErrorException('Backblaze B2 configuration is incomplete. Please check your environment variables.');
    }

    this.bucketName = bucketName;
    this.region = region;

    this.s3Client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });
  }

  async upload(fileBuffer: Buffer, mimeType: string): Promise<string> {
    const key = `${uuidv4()}.pdf`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      ACL: 'public-read',
    });

    try {
      await this.s3Client.send(command);
      // Construct the public URL for the file
      const publicUrl = `https://s3.${this.region}.backblazeb2.com/${this.bucketName}/${key}`;
      return publicUrl;
    } catch (error) {
      console.error('Error uploading file to Backblaze B2:', error);
      throw new InternalServerErrorException('Failed to upload PDF file.');
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl) {
      console.log('No file URL provided, skipping deletion.');
      return;
    }

    try {
      const key = fileUrl.substring(fileUrl.lastIndexOf('/') + 1);

      if (!key) {
        console.warn(`Could not extract key from URL: ${fileUrl}`);
        return;
      }

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      console.log(`Successfully deleted file ${key} from bucket ${this.bucketName}`);
    } catch (error) {
      console.error(`Failed to delete file from Backblaze B2 for URL: ${fileUrl}`, error);
      // Do not re-throw, as failing to delete the file should not prevent DB record deletion.
    }
  }
}
