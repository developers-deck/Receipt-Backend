"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pg_1 = require("pg");
const schema = require("./schema");
const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbName = process.env.DB_NAME;
if (!dbHost || !dbPort || !dbUser || !dbPassword || !dbName) {
    throw new Error('Database environment variables (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME) are not set');
}
console.log('DB_HOST:', dbHost);
console.log('DB_PORT:', dbPort);
console.log('DB_USER:', dbUser);
console.log('DB_NAME:', dbName);
console.log('Creating new Pool...');
const pool = new pg_1.Pool({
    host: dbHost,
    port: parseInt(dbPort, 10),
    user: dbUser,
    password: dbPassword,
    database: dbName,
});
console.log('Pool created.');
console.log('Initializing drizzle...');
exports.db = (0, node_postgres_1.drizzle)(pool, { schema });
console.log('Drizzle initialized.');
//# sourceMappingURL=index.js.map