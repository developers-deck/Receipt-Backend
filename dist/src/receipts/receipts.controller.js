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
var ReceiptsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReceiptsController = void 0;
const common_1 = require("@nestjs/common");
const receipts_service_1 = require("./receipts.service");
const get_receipt_dto_1 = require("./dto/get-receipt.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const role_enum_1 = require("../auth/enums/role.enum");
let ReceiptsController = ReceiptsController_1 = class ReceiptsController {
    receiptsService;
    logger = new common_1.Logger(ReceiptsController_1.name);
    constructor(receiptsService) {
        this.receiptsService = receiptsService;
    }
    async createReceipt(getReceiptDto, req) {
        const userId = req.user.id;
        console.log('userId in controller:', userId);
        return this.receiptsService.createReceipt(getReceiptDto, userId);
    }
    async getAllReceipts(page = 1, limit = 10, companyName, customerName, tin) {
        return this.receiptsService.findAll(null, { page: +page, limit: +limit, companyName, customerName, tin });
    }
    async findMyReceipts(req, page = 1, limit = 10, companyName, customerName, tin) {
        this.logger.log(`[findMyReceipts] - Initiated for user: ${JSON.stringify(req.user)}`);
        console.log('req.user:', req.user);
        const user = { id: req.user.id };
        return this.receiptsService.findAll(user, { page: +page, limit: +limit, companyName, customerName, tin });
    }
    async getReceiptById(id, req) {
        return this.receiptsService.getReceiptById(id, req.user);
    }
    async deleteReceipt(id, req) {
        await this.receiptsService.deleteReceipt(id, req.user);
    }
    async downloadPdf(id, req, res) {
        const pdfBuffer = await this.receiptsService.exportReceiptPdf(id, req.user);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=receipt-${id}.pdf`);
        res.send(pdfBuffer);
    }
    async getMyStats(req) {
        const user = { id: req.user.id };
        return this.receiptsService.getUserStats(user);
    }
    async retryPdfGeneration(id, req) {
        this.logger.log(`Retry PDF generation requested for receipt ID: ${id} by user: ${req.user.id}`);
        return this.receiptsService.retryPdfGeneration(+id, req.user.id);
    }
    async retryAllFailedPdfGenerations(req) {
        this.logger.log(`Retry all failed PDF generations requested by user: ${req.user.id}`);
        return this.receiptsService.retryAllFailedPdfGenerations(req.user.id);
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
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('companyName')),
    __param(3, (0, common_1.Query)('customerName')),
    __param(4, (0, common_1.Query)('tin')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ReceiptsController.prototype, "getAllReceipts", null);
__decorate([
    (0, common_1.Get)('mine'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.User, role_enum_1.Role.Admin),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('companyName')),
    __param(4, (0, common_1.Query)('customerName')),
    __param(5, (0, common_1.Query)('tin')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ReceiptsController.prototype, "findMyReceipts", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.User, role_enum_1.Role.Admin),
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
__decorate([
    (0, common_1.Get)(':id/pdf'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ReceiptsController.prototype, "downloadPdf", null);
__decorate([
    (0, common_1.Get)('mine/stats'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.User, role_enum_1.Role.Admin),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReceiptsController.prototype, "getMyStats", null);
__decorate([
    (0, common_1.Post)(':id/retry-pdf'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.User, role_enum_1.Role.Admin),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReceiptsController.prototype, "retryPdfGeneration", null);
__decorate([
    (0, common_1.Post)('mine/retry-all-pdfs'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.User, role_enum_1.Role.Admin),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReceiptsController.prototype, "retryAllFailedPdfGenerations", null);
exports.ReceiptsController = ReceiptsController = ReceiptsController_1 = __decorate([
    (0, common_1.Controller)('receipts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [receipts_service_1.ReceiptsService])
], ReceiptsController);
//# sourceMappingURL=receipts.controller.js.map