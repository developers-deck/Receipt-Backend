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
let FileUploadService = class FileUploadService {
    configService;
    s3Client;
    bucketName;
    constructor(configService) {
        this.configService = configService;
        const bucketName = this.configService.get('B2_BUCKET_NAME');
        const endpoint = this.configService.get('B2_ENDPOINT');
        const accessKeyId = this.configService.get('B2_APPLICATION_KEY_ID');
        const secretAccessKey = this.configService.get('B2_APPLICATION_KEY');
        if (!bucketName || !endpoint || !accessKeyId || !secretAccessKey) {
            throw new Error('Backblaze B2 credentials are not fully configured in .env file');
        }
        this.bucketName = bucketName;
        this.s3Client = new client_s3_1.S3Client({
            endpoint,
            region: 'us-west-000',
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
    }
    async uploadFile(buffer, fileName, contentType) {
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: fileName,
            Body: buffer,
            ContentType: contentType,
        });
        await this.s3Client.send(command);
        return `https://f000.backblazeb2.com/file/${this.bucketName}/${fileName}`;
    }
};
exports.FileUploadService = FileUploadService;
exports.FileUploadService = FileUploadService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FileUploadService);
//# sourceMappingURL=file-upload.service.js.map