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
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptsController = void 0;
const common_1 = require("@nestjs/common");
const receipts_service_1 = require("./receipts.service");
const create_receipt_dto_1 = require("./dto/create-receipt.dto");
const roles_guard_1 = require("../auth/roles.guard");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const get_receipt_dto_1 = require("./dto/get-receipt.dto");
let ReceiptsController = class ReceiptsController {
    receiptsService;
    constructor(receiptsService) {
        this.receiptsService = receiptsService;
    }
    async create(createReceiptDto) {
        try {
            return await this.receiptsService.createAndVerifyReceipt(createReceiptDto);
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            if (error.code === '23505') {
                throw new common_1.BadRequestException('Receipt number already exists');
            }
            throw error;
        }
    }
    async findAll() {
        return this.receiptsService.findAll();
    }
    async findOne(id) {
        const receipt = await this.receiptsService.findOne(id);
        getAllReceipts();
        {
            return await this.receiptsService.getAllReceipts();
        }
        getReceipt(, req, , getReceiptDto, get_receipt_dto_1.GetReceiptDto);
        {
            const { verificationCode, receiptTime } = getReceiptDto;
            const receipt = await this.receiptsService.getReceipt(verificationCode, receiptTime, req.user.userId);
            if (!receipt) {
                throw new common_1.NotFoundException('Failed to get receipt data.');
            }
            return receipt;
        }
        getMyReceipts(, req);
        {
            return await this.receiptsService.getReceiptsByUserId(req.user.userId);
        }
        getReceiptById(, id, string, , req);
        {
            const receipt = await this.receiptsService.getReceiptById(+id, req.user);
            if (!receipt) {
                throw new common_1.NotFoundException(`Receipt with ID ${id} not found`);
            }
            return receipt;
        }
    }
};
exports.ReceiptsController = ReceiptsController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_receipt_dto_1.CreateReceiptDto]),
    __metadata("design:returntype", typeof (_a = typeof Promise !== "undefined" && Promise) === "function" ? _a : Object)
], ReceiptsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", typeof (_b = typeof Promise !== "undefined" && Promise) === "function" ? _b : Object)
], ReceiptsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", typeof (_c = typeof Promise !== "undefined" && Promise) === "function" ? _c : Object)
], ReceiptsController.prototype, "findOne", null);
exports.ReceiptsController = ReceiptsController = __decorate([
    (0, common_1.Controller)('receipts'),
    UseGuards(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [receipts_service_1.ReceiptsService])
], ReceiptsController);
//# sourceMappingURL=receipts.controller.js.map