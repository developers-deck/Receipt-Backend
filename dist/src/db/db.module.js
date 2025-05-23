"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbModule = void 0;
const common_1 = require("@nestjs/common");
const db_provider_1 = require("./db.provider");
const postgres_js_1 = require("drizzle-orm/postgres-js");
const postgres = require('postgres');
const dbProvider = {
    provide: db_provider_1.DB_PROVIDER,
    useFactory: async () => {
        const client = postgres(process.env.DATABASE_URL || {
            host: 'localhost',
            port: 5432,
            database: 'postgres',
            username: 'postgres',
            password: 'icui4cu'
        });
        return (0, postgres_js_1.drizzle)(client);
    },
};
let DbModule = class DbModule {
};
exports.DbModule = DbModule;
exports.DbModule = DbModule = __decorate([
    (0, common_1.Module)({
        providers: [dbProvider, db_provider_1.DbService],
        exports: [db_provider_1.DB_PROVIDER, db_provider_1.DbService],
    })
], DbModule);
//# sourceMappingURL=db.module.js.map