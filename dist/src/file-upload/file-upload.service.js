"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileUploadService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const uuid_1 = require("uuid");
let FileUploadService = class FileUploadService {
    configService;
    s3Client;
    bucketName;
    region;
    constructor(configService) {
        this.configService = configService;
        const region = this.configService.get('B2_REGION');
        const endpoint = this.configService.get('B2_ENDPOINT');
        const accessKeyId = this.configService.get('B2_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get('B2_SECRET_ACCESS_KEY');
        const bucketName = this.configService.get('B2_BUCKET_NAME');
        if (!region || !endpoint || !accessKeyId || !secretAccessKey || !bucketName) {
            throw new common_1.InternalServerErrorException('Backblaze B2 configuration is incomplete. Please check your environment variables.');
        }
        this.bucketName = bucketName;
        this.region = region;
        this.s3Client = new client_s3_1.S3Client({
            region,
            endpoint,
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey,
            },
        });
    }
    async upload(fileBuffer, mimeType) {
        const key = `${(0, uuid_1.v4)()}.pdf`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: fileBuffer,
            ContentType: mimeType,
            ACL: 'public-read',
        });
        try {
            await this.s3Client.send(command);
            const publicUrl = `https://s3.${this.region}.backblazeb2.com/${this.bucketName}/${key}`;
            return publicUrl;
        }
        catch (error) {
            console.error('Error uploading file to Backblaze B2:', error);
            throw new common_1.InternalServerErrorException('Failed to upload PDF file.');
        }
    }
    async deleteFile(fileUrl) {
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
            const command = new client_s3_1.DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });
            await this.s3Client.send(command);
            console.log(`Successfully deleted file ${key} from bucket ${this.bucketName}`);
        }
        catch (error) {
            console.error(`Failed to delete file from Backblaze B2 for URL: ${fileUrl}`, error);
        }
    }
};
exports.FileUploadService = FileUploadService;
exports.FileUploadService = FileUploadService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FileUploadService);
//# sourceMappingURL=file-upload.service.js.map