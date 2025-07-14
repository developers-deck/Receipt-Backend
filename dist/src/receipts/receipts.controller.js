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
const get_receipt_dto_1 = require("./dto/get-receipt.dto");
const roles_decorator_1 = require("../auth/roles.decorator");
const role_enum_1 = require("../auth/enums/role.enum");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
let ReceiptsController = class ReceiptsController {
    receiptsService;
    constructor(receiptsService) {
        this.receiptsService = receiptsService;
    }
    async createReceipt(getReceiptDto, req) {
        const { verificationCode, receiptTime } = getReceiptDto;
        const userId = req.user.userId;
        return this.receiptsService.getReceipt(verificationCode, receiptTime, userId);
    }
    async getAllReceipts() {
        return this.receiptsService.getAllReceipts();
    }
    async getReceiptsForUser(userId) {
        return this.receiptsService.getReceiptsByUserId(userId);
    }
    async getMyReceipts(req) {
        const userId = req.user.userId;
        return this.receiptsService.getReceiptsByUserId(userId);
    }
    async getReceiptById(id, req) {
        const receiptId = id;
        const requestingUser = req.user;
        const receipt = await this.receiptsService.getReceiptById(receiptId);
        if (!receipt) {
            throw new common_1.NotFoundException(`Receipt with ID ${id} not found`);
        }
        if (requestingUser.role !== role_enum_1.Role.Admin && receipt.userId !== requestingUser.userId) {
            throw new common_1.UnauthorizedException('You are not authorized to access this receipt.');
        }
        return receipt;
    }
    async deleteReceipt(id, req) {
        const receiptId = parseInt(id, 10);
        if (isNaN(receiptId)) {
            throw new common_1.NotFoundException(`Invalid receipt ID: ${id}`);
        }
        await this.receiptsService.deleteReceipt(receiptId, req.user);
    }
};
exports.ReceiptsController = ReceiptsController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.User, role_enum_1.Role.Admin),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_receipt_dto_1.GetReceiptDto, Object]),
    __metadata("design:returntype", Promise)
], ReceiptsController.prototype, "createReceipt", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.Admin),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReceiptsController.prototype, "getAllReceipts", null);
__decorate([
    (0, common_1.Get)('user/:userId'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.Admin),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ReceiptsController.prototype, "getReceiptsForUser", null);
__decorate([
    (0, common_1.Get)('mine'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.User, role_enum_1.Role.Admin),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReceiptsController.prototype, "getMyReceipts", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.Admin, role_enum_1.Role.User),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReceiptsController.prototype, "getReceiptById", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.User, role_enum_1.Role.Admin),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReceiptsController.prototype, "deleteReceipt", null);
exports.ReceiptsController = ReceiptsController = __decorate([
    (0, common_1.Controller)('receipts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [receipts_service_1.ReceiptsService])
], ReceiptsController);
//# sourceMappingURL=receipts.controller.js.map