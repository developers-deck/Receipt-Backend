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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptsController = void 0;
const common_1 = require("@nestjs/common");
const receipts_service_1 = require("./receipts.service");
let ReceiptsController = class ReceiptsController {
    receiptsService;
    constructor(receiptsService) {
        this.receiptsService = receiptsService;
    }
    async getAllReceipts() {
        return await this.receiptsService.getAllReceipts();
    }
    async getReceipt(verificationCode, receiptTime) {
        if (!receiptTime) {
            throw new common_1.BadRequestException('Receipt time is required.');
        }
        const receipt = await this.receiptsService.getReceipt(verificationCode, receiptTime);
        if (!receipt) {
            throw new common_1.NotFoundException('Failed to get receipt data.');
        }
        return receipt;
    }
    async getReceiptById(id) {
        const receipt = await this.receiptsService.getReceiptById(+id);
        if (!receipt) {
            throw new common_1.NotFoundException(`Receipt with ID ${id} not found`);
        }
        return receipt;
    }
    async getReceiptsByCompanyName(companyName) {
        return await this.receiptsService.getReceiptsByCompanyName(companyName);
    }
};
exports.ReceiptsController = ReceiptsController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReceiptsController.prototype, "getAllReceipts", null);
__decorate([
    (0, common_1.Get)(':verificationCode'),
    __param(0, (0, common_1.Param)('verificationCode')),
    __param(1, (0, common_1.Query)('time')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ReceiptsController.prototype, "getReceipt", null);
__decorate([
    (0, common_1.Get)('id/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReceiptsController.prototype, "getReceiptById", null);
__decorate([
    (0, common_1.Get)('by-company/:companyName'),
    __param(0, (0, common_1.Param)('companyName')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReceiptsController.prototype, "getReceiptsByCompanyName", null);
exports.ReceiptsController = ReceiptsController = __decorate([
    (0, common_1.Controller)('receipts'),
    __metadata("design:paramtypes", [receipts_service_1.ReceiptsService])
], ReceiptsController);
//# sourceMappingURL=receipts.controller.js.map