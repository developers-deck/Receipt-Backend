"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptsModule = void 0;
const common_1 = require("@nestjs/common");
const receipts_service_1 = require("./receipts.service");
const receipts_controller_1 = require("./receipts.controller");
const db_module_1 = require("../db/db.module");
const redis_module_1 = require("../redis/redis.module");
const file_upload_module_1 = require("../file-upload/file-upload.module");
const pdf_generator_service_1 = require("./pdf-generator.service");
const scraper_service_1 = require("./scraper.service");
const pdf_queue_service_1 = require("./pdf-queue.service");
let ReceiptsModule = class ReceiptsModule {
};
exports.ReceiptsModule = ReceiptsModule;
exports.ReceiptsModule = ReceiptsModule = __decorate([
    (0, common_1.Module)({
        imports: [db_module_1.DbModule, file_upload_module_1.FileUploadModule, redis_module_1.RedisModule],
        controllers: [receipts_controller_1.ReceiptsController],
        providers: [
            receipts_service_1.ReceiptsService,
            pdf_generator_service_1.PdfGeneratorService,
            scraper_service_1.ScraperService,
            pdf_queue_service_1.PdfQueueService,
        ],
        exports: [receipts_service_1.ReceiptsService],
    })
], ReceiptsModule);
//# sourceMappingURL=receipts.module.js.map