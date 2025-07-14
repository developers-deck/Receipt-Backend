"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    console.log('[Bootstrap] Starting application...');
    try {
        console.log('[Bootstrap] Creating Nest application instance...');
        const app = await core_1.NestFactory.create(app_module_1.AppModule);
        console.log('[Bootstrap] Nest application instance created.');
        const port = process.env.PORT ?? 3000;
        await app.listen(port);
        console.log(`[Bootstrap] Application is running on: ${await app.getUrl()}`);
    }
    catch (error) {
        console.error('[Bootstrap] Error during application startup:', error);
        process.exit(1);
    }
}
bootstrap();
//# sourceMappingURL=main.js.map