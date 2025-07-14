"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbService = exports.dbProvider = exports.DB_PROVIDER = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = require("pg");
const schema = require("./schema");
exports.DB_PROVIDER = 'DB_PROVIDER';
exports.dbProvider = {
    provide: exports.DB_PROVIDER,
    inject: [config_1.ConfigService],
    useFactory: async (configService) => {
        const dbHost = configService.get('DB_HOST');
        const dbPort = configService.get('DB_PORT');
        const dbUser = configService.get('DB_USER');
        const dbPassword = configService.get('DB_PASSWORD');
        const dbName = configService.get('DB_NAME');
        const dbTimeout = configService.get('DB_TIMEOUT', 30000);
        if (!dbHost || !dbPort || !dbUser || !dbPassword || !dbName) {
            throw new Error('Database environment variables are not set');
        }
        console.log('Creating new Pool...');
        const pool = new pg_1.Pool({
            host: dbHost,
            port: dbPort,
            user: dbUser,
            password: dbPassword,
            database: dbName,
            idleTimeoutMillis: dbTimeout,
            connectionTimeoutMillis: dbTimeout,
        });
        console.log('Pool created.');
        try {
            await pool.query('SELECT NOW()');
            console.log('Database connection successful.');
        }
        catch (error) {
            console.error('Failed to connect to the database:', error);
            throw error;
        }
        console.log('Initializing drizzle...');
        const db = (0, node_postgres_1.drizzle)(pool, { schema, logger: true });
        console.log('Drizzle initialized.');
        return db;
    },
};
let DbService = class DbService {
};
exports.DbService = DbService;
exports.DbService = DbService = __decorate([
    (0, common_1.Injectable)()
], DbService);
//# sourceMappingURL=db.provider.js.map