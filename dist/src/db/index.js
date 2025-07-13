"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.drizzle = exports.schema = void 0;
const schema = require("./schema");
exports.schema = schema;
var node_postgres_1 = require("drizzle-orm/node-postgres");
Object.defineProperty(exports, "drizzle", { enumerable: true, get: function () { return node_postgres_1.drizzle; } });
//# sourceMappingURL=index.js.map